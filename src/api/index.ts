import { createAuthApi, type AuthClient } from './authApi';
import { createFriendsApi, type RpcClient } from './friendsApi';
import { createGroupsApi } from './groupsApi';
import { createRidersApi } from './ridersApi';
import { createProfilesApi, type DbClient } from './profilesApi';
import { getClient } from './supabaseClient';

let auth: ReturnType<typeof createAuthApi> | null = null;
let profiles: ReturnType<typeof createProfilesApi> | null = null;
let groups: ReturnType<typeof createGroupsApi> | null = null;
let riders: ReturnType<typeof createRidersApi> | null = null;
let friends: ReturnType<typeof createFriendsApi> | null = null;

export const getAuthApi = () => (auth ??= createAuthApi(getClient() as unknown as AuthClient));
export const getProfilesApi = () => (profiles ??= createProfilesApi(getClient() as unknown as DbClient));
export const getFriendsApi = () => (friends ??= createFriendsApi(getClient() as unknown as RpcClient));
export const getRidersApi = () => (riders ??= createRidersApi(getClient() as unknown as RpcClient));
export const getGroupsApi = () => (groups ??= createGroupsApi(getClient() as unknown as RpcClient));
