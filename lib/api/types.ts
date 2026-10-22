export type ApiSuccess<T> = {
    success: true;
    message: string;
    data: T;
};

export type ApiFieldError = {
    field: string;
    message: string;
};

export type ApiErrorResponse = {
    success: false;
    message: string;
    code?: string;
    errors?: ApiFieldError[];
};

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorResponse;

export const USER_ROLES = ["OWNER", "ADMIN", "COACH", "MEMBER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

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
    role?: string;
    birthDay?: number;
    birthMonth?: number;
    whatsappNumber?: string;
};

export type BackendLoginRequest = {
    email: string;
    password: string;
};

/**
 * Token payload returned by the authentication server.
 * Expiry values can be duration strings (e.g. "15m", "7d"),
 * ISO 8601 timestamps, or numeric seconds.
 */
export type BackendTokens = {
    accessToken: string;
    accessTokenExpiresIn: string;
    refreshToken: string;
    refreshTokenExpiresIn?: string;
    refreshTokenExpiresAt?: string;
};

export type BackendLoginData = {
    user: BackendUser;
    tokens: BackendTokens;
};

export type BackendRefreshRequest = {
    refreshToken: string;
};

export type BackendRefreshData = {
    tokens?: BackendTokens;
    accessToken?: string;
    accessTokenExpiresIn?: string;
    refreshToken?: string;
    refreshTokenExpiresIn?: string;
};

/**
 * Returned inside `data` upon successful OTP verification.
 */
export type BackendVerifyOtpData = {
    resetToken: string;
};

export type BackendLogoutRequest = {
    refreshToken: string;
};