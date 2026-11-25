import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { getAuthApi, getProfilesApi } from './src/api';
import { nextStage } from './src/navigation/stage';
import type { Profile } from './src/profile/types';
import { ForgotPasswordScreen } from './src/screens/auth/ForgotPasswordScreen';
import { LoginScreen } from './src/screens/auth/LoginScreen';
import { RegisterScreen, type RegisterValues } from './src/screens/auth/RegisterScreen';
import { BatterySetupScreen } from './src/screens/BatterySetupScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { ProfileSetupScreen } from './src/screens/profile/ProfileSetupScreen';
import { TrackScreen } from './src/screens/TrackScreen';
import { Button, Notice, styles as ui } from './src/screens/ui';

const SETUP_DONE_KEY = 'motoamici.setupDone';
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

function PermissionsFlow({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<'permissions' | 'battery-guide'>('permissions');
  return step === 'permissions' ? (
    <OnboardingScreen onDone={() => setStep('battery-guide')} />
  ) : (
    <BatterySetupScreen onDone={onDone} />
  );
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined); // undefined = ancora da leggere
  const [permissionsDone, setPermissionsDone] = useState<boolean | null>(null);
  const [authScreen, setAuthScreen] = useState<'login' | 'register' | 'forgot'>('login');
  const [notice, setNotice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const busyRef = useRef(false); // mentre si registra, ignoriamo gli eventi di accesso per non far lampeggiare le schermate

  const loadProfile = useCallback(async () => {
    try {
      setLoadError(null);
      setProfile(await getProfilesApi().getMyProfile());
    } catch (e) {
      setLoadError(errMsg(e));
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(SETUP_DONE_KEY)
      .then((v) => setPermissionsDone(v === '1'))
      .catch(() => setPermissionsDone(false));
    try {
      const auth = getAuthApi();
      auth.getSession().then(setLoggedIn).catch((e) => setLoadError(errMsg(e)));
      return auth.onSessionChange((v) => {
        if (!busyRef.current) setLoggedIn(v);
      });
    } catch (e) {
      setLoadError(errMsg(e));
    }
  }, []);

  useEffect(() => {
    if (loggedIn) loadProfile();
    else setProfile(undefined);
  }, [loggedIn, loadProfile]);

  const register = async (v: RegisterValues) => {
    busyRef.current = true;
    try {
      const auth = getAuthApi();
      await auth.signUp(v.email, v.password);
      if (!(await auth.getSession())) throw new Error("Controlla la tua email per confermare l'account, poi accedi");
      try {
        await getProfilesApi().saveProfile({ nickname: v.nickname, displayName: null, gender: 'x', avatar: v.avatar, bikeType: null });
        setNotice(null);
      } catch (e) {
        setNotice(errMsg(e)); // es. nickname già in uso: lo si sceglie di nuovo nella schermata «Completa il profilo»
      }
      setLoggedIn(true);
      await loadProfile();
    } finally {
      busyRef.current = false;
    }
  };

  const saveSetup = async (v: { nickname: string; avatar: string; gender: Profile['gender'] }) => {
    await getProfilesApi().saveProfile({ nickname: v.nickname, displayName: null, gender: v.gender, avatar: v.avatar, bikeType: null });
    setNotice(null);
    await loadProfile();
  };

  const signOut = async () => {
    try {
      await getAuthApi().signOut();
    } finally {
      setLoggedIn(false);
      setProfile(undefined);
      setAuthScreen('login');
    }
  };

  const finishPermissions = () => {
    AsyncStorage.setItem(SETUP_DONE_KEY, '1').catch(() => undefined);
    setPermissionsDone(true);
  };

  let body;
  if (loadError) {
    body = (
      <View style={ui.screen}>
        <Notice text={`Non riesco a collegarmi: ${loadError}`} />
        <Button title="Riprova" onPress={() => (loggedIn ? loadProfile() : setLoadError(null))} />
        {loggedIn ? <Button title="Esci" onPress={signOut} variant="secondary" /> : null}
      </View>
    );
  } else if (loggedIn === null || permissionsDone === null || (loggedIn && profile === undefined)) {
    body = (
      <View style={[ui.screen, { alignItems: 'center' }]}>
        <ActivityIndicator size="large" />
        <Text>Caricamento…</Text>
      </View>
    );
  } else {
    const stage = nextStage({ loggedIn, hasProfile: !!profile, permissionsDone });
    if (stage === 'login') {
      body =
        authScreen === 'register' ? (
          <RegisterScreen onRegister={register} onBack={() => setAuthScreen('login')} />
        ) : authScreen === 'forgot' ? (
          <ForgotPasswordScreen onSend={(e) => getAuthApi().sendPasswordReset(e)} onBack={() => setAuthScreen('login')} />
        ) : (
          <LoginScreen
            onSignIn={(e, p) => getAuthApi().signIn(e, p)}
            onGoRegister={() => setAuthScreen('register')}
            onGoForgot={() => setAuthScreen('forgot')}
          />
        );
    } else if (stage === 'profile') {
      body = <ProfileSetupScreen notice={notice} onSave={saveSetup} onSignOut={signOut} />;
    } else if (stage === 'permissions') {
      body = <PermissionsFlow onDone={finishPermissions} />;
    } else {
      body = <TrackScreen nickname={profile?.nickname ?? ''} onSignOut={signOut} />;
    }
  }

  return (
    <>
      {body}
      <StatusBar style="auto" />
    </>
  );
}
