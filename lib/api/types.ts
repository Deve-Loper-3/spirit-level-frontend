export type ApiSucces<T> = {
    success: true;
    message: string;
    data: T;
}

export const GENDERS = ['MALE', 'FEMALE', 'PREFER_NOT_TO_SAY'] as const;
export type Gender = (typeof GENDERS)[number];

export type BackendUser = {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    whatsappNumber: string | null;
    gender: Gender;
    birthDay: string | null;
    birthMonth: string | null;
    role: string;
    status: string;
    createdAt: string;
};

export type BackendRegisterRequest = {
    fullName: string;
    email: string;
    phone: string;
    gender: Gender;
    password: string;
    birthDay?: number;
    birthMonth?: number;
    whatsappNumber?: string;
}

export type BackendLoginRequest = {
    email: string;
    password: string;
}

export type BackendTokens = {
    accessToken: string;
    accessTokenExpiresIn: string;
    refreshToken: string;
    refreshTokenExpiresIn: string;
}

export type BackendLoginData = {
    user: BackendUser;
    tokens: BackendTokens;
}

// What sits inside `data` in a successful verify-otp response.
// ASSUMPTION: the backend returns a reset token. Confirm the field name.
export type BackendVerifyOtpData = {
    resetToken: string;
};