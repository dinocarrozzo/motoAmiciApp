export type BikeType = 'stradale-sportiva' | 'custom' | 'naked' | 'enduro' | 'maxienduro';
export type Gender = 'm' | 'f' | 'x';

export type Profile = {
  id: string;
  nickname: string;
  displayName: string | null;
  gender: Gender;
  avatar: string;
  bikeType: BikeType | null;
};

/** I soli dati pubblici di un profilo: quelli che escono nella ricerca e negli elenchi. */
export type ProfileSummary = Pick<Profile, 'id' | 'nickname' | 'displayName' | 'avatar' | 'gender'>;

export type Friendship = { requester: string; addressee: string; status: 'pending' | 'accepted' };
export type Block = { blocker: string; blocked: string };
