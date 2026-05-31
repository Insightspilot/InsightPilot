export interface LoginResponse {
  force_password_change: boolean;
  orgs: { id: string; name: string; slug: string; role: string }[] | null;
}

export interface SignupResponse {
  message: string;
  otp: string | null;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  is_email_verified: boolean;
  created_at: string;
  role: string | null;
}
