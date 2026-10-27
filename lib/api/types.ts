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
