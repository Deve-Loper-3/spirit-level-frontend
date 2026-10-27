import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getRoleHome, isStaffRole } from "@/lib/auth/roles";

export default async function Home() {
    const role = (await cookies()).get("user_role")?.value;
    redirect(isStaffRole(role) ? getRoleHome(role) : "/login");
}
