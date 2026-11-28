import type { Gender } from '../profile/types';
import type { RideType } from '../map/types';

export type MyGroup = {
  groupId: string;
  rideType: RideType;
  destination: string | null;
  inviteCode: string;
  role: 'owner' | 'member';
  memberCount: number;
  rideId: string | null;
};

export type Participant = {
  id: string;
  nickname: string;
  avatar: string;
  gender: Gender;
  role: 'owner' | 'member';
  riding: boolean;
};

export type IncomingRequest = {
  requestId: string;
  groupId: string;
  requesterId: string;
  nickname: string;
  avatar: string;
  gender: Gender;
  message: string | null;
  createdAt: number;
};

export type RequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export type MyRequest = {
  requestId: string;
  groupId: string;
  status: RequestStatus;
  meet: { lat: number; lng: number } | null;
  meetNote: string | null;
  answeredAt: number | null;
  createdAt: number;
};

export type GroupInvite = {
  groupId: string;
  inviterNickname: string;
  rideType: RideType;
  destination: string | null;
  createdAt: number;
};

export type MeetPoint = { lat: number; lng: number } | null;
