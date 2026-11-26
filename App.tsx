import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAuthApi, getProfilesApi } from './src/api';
import { parseRecoveryUrl } from './src/auth/recoveryLink';
import { nextStage } from './src/navigation/stage';
import { isProfileComplete } from './src/profile/completeness';
import type { Profile } from './src/profile/types';
import { ForgotPasswordScreen } from './src/screens/auth/ForgotPasswordScreen';
import { LoginScreen } from './src/screens/auth/LoginScreen';
import { ResetPasswordScreen } from './src/screens/auth/ResetPasswordScreen';
import { RegisterScreen, type RegisterValues } from './src/screens/auth/RegisterScreen';
import { BatterySetupScreen } from './src/screens/BatterySetupScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { AppTabs } from './src/screens/AppTabs';
import { FriendsScreen } from './src/screens/friends/FriendsScreen';
import { ProfileEditScreen } from './src/screens/profile/ProfileEditScreen';
import { ProfileSetupScreen, type SetupValues } from './src/screens/profile/ProfileSetupScreen';
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
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  // Lo schermo arriva fino in fondo: lasciamo libero lo spazio dei tasti di navigazione del telefono.
  const insets = useSafeAreaInsets();
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined); // undefined = ancora da leggere
  const [permissionsDone, setPermissionsDone] = useState<boolean | null>(null);
  const [authScreen, setAuthScreen] = useState<'login' | 'register' | 'forgot'>('login');
  const [notice, setNotice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false); // sta scegliendo una nuova password dopo il link nell'email
  const [linkNotice, setLinkNotice] = useState<string | null>(null);
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

  // Link di recupero password ricevuto per email: apre la sessione e mostra «nuova password».
  const handleUrl = useCallback(async (url: string | null | undefined) => {
    if (!url) return;
    const link = parseRecoveryUrl(url);
    if (!link) return;
    if (link.kind === 'error') return setLinkNotice(link.message);
    setRecovering(true); // prima della sessione, così le altre schermate non lampeggiano
    try {
      await getAuthApi().recoverSession(link.accessToken, link.refreshToken);
      setLinkNotice(null);
    } catch (e) {
      setRecovering(false);
      setLinkNotice(`Il link non è più valido: richiedine uno nuovo (${errMsg(e)})`);
    }
  }, []);

  useEffect(() => {
    Linking.getInitialURL().then(handleUrl).catch(() => undefined);
    const sub = Linking.addEventListener('url', (e) => handleUrl(e.url));
    return () => sub.remove();
  }, [handleUrl]);

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
        await getProfilesApi().saveProfile({ nickname: v.nickname, displayName: null, gender: v.gender, avatar: v.avatar, bikeType: v.bikeType });
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

  const saveSetup = async (v: SetupValues) => {
    await getProfilesApi().saveProfile({ nickname: v.nickname, displayName: profile?.displayName ?? null, gender: v.gender, avatar: v.avatar, bikeType: v.bikeType });
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
  if (recovering) {
    body = (
      <ResetPasswordScreen
        onSubmit={(pw) => getAuthApi().updatePassword(pw)}
        onDone={() => {
          setRecovering(false);
          setLinkNotice(null);
        }}
      />
    );
  } else if (loadError) {
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
    const stage = nextStage({ loggedIn, hasProfile: isProfileComplete(profile), permissionsDone });
    if (stage === 'login') {
      body =
        authScreen === 'register' ? (
          <RegisterScreen onRegister={register} onBack={() => setAuthScreen('login')} />
        ) : authScreen === 'forgot' ? (
          <ForgotPasswordScreen onSend={(e) => getAuthApi().sendPasswordReset(e)} onBack={() => setAuthScreen('login')} />
        ) : (
          <LoginScreen
            notice={linkNotice}
            onSignIn={(e, p) => getAuthApi().signIn(e, p)}
            onGoRegister={() => setAuthScreen('register')}
            onGoForgot={() => setAuthScreen('forgot')}
          />
        );
    } else if (stage === 'profile') {
      body = <ProfileSetupScreen initial={profile ?? null} notice={notice} onSave={saveSetup} onSignOut={signOut} />;
    } else if (stage === 'permissions') {
      body = <PermissionsFlow onDone={finishPermissions} />;
    } else {
      body = (
        <AppTabs
          tabs={[
            { id: 'giro', label: 'Giro', icon: '🏍️', render: () => <TrackScreen nickname={profile?.nickname ?? ''} /> },
            { id: 'amici', label: 'Amici', icon: '👥', render: (isActive) => <FriendsScreen myId={profile!.id} myNickname={profile!.nickname} active={isActive} /> },
            { id: 'profilo', label: 'Profilo', icon: '👤', render: () => <ProfileEditScreen onSaved={loadProfile} onSignOut={signOut} /> },
          ]}
        />
      );
    }
  }

  return (
    <View style={{ flex: 1, paddingBottom: insets.bottom }}>
      {body}
      <StatusBar style="auto" />
    </View>
  );
}
