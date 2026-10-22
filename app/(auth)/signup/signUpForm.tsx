"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PasswordInput from "@/components/(auth)/PasswordInput";
import {
    inputClass,
    labelClass,
    primaryButtonClass,
} from "@/components/(auth)/styles";
import { passwordProblem, PASSWORD_HINT } from "@/lib/validation/password";

function todayISO() {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${month}-${day}`;
}

export default function SignUpForm() {
    const router = useRouter();
    const [values, setValues] = useState({
        firstName: "",
        lastName: "",
        email: "",
        dob: "",
        phoneNum: "",
        gender: "",
        whatsappNum: "",
        password: "",
    });
    const [whatsappSameAsPhone, setWhatsappSameAsPhone] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const dobRef = useRef<HTMLInputElement>(null);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const { name, value } = e.target;
        setValues((prev) => ({ ...prev, [name]: value }));
    }

    function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
        const { name, value } = e.target;
        setValues((prev) => ({ ...prev, [name]: value }));
    }

    function handleWhatsappToggle(same: boolean) {
        setWhatsappSameAsPhone(same);
        if (same) setValues((prev) => ({ ...prev, whatsappNum: "" }));
    }

    function openPicker() {
        try {
            dobRef.current?.showPicker();
        } catch {
            // Ignore: fallback to native behavior
        }
    }

    function validate(): string {
        if (values.dob > todayISO()) return "Date of birth can't be in the future.";
        const problem = passwordProblem(values.password);
        if (problem) return problem;
        return "";
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setError("");

        const problem = validate();
        if (problem) {
            setError(problem);
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch("/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    firstName: values.firstName,
                    lastName: values.lastName,
                    email: values.email,
                    phone: values.phoneNum,
                    whatsappNumber: whatsappSameAsPhone ? values.phoneNum : values.whatsappNum,
                    gender: values.gender,
                    password: values.password,
                    dob: values.dob,
                }),
            });

            const data = (await res.json()) as { message?: string };
            if (!res.ok) {
                setError(data.message ?? "Something went wrong. Please try again.");
                return;
            }

            // Redirect to login with pending approval state
            router.push("/login?registered=pending");
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <form onSubmit={handleSubmit}>
            {error && (
                <div
                    role="alert"
                    className="mb-5 rounded-[6px] border border-[#F2C4C0] bg-[#FDF2F1] px-3 py-2 text-[13px] text-[#B42318]"
                >
                    {error}
                </div>
            )}

            <div className="mb-[18px] grid gap-[18px] sm:grid-cols-2">
                <div>
                    <label htmlFor="firstName" className={labelClass}>
                        First name
                    </label>
                    <input
                        type="text"
                        id="firstName"
                        name="firstName"
                        value={values.firstName}
                        onChange={handleChange}
                        autoComplete="given-name"
                        required
                        className={inputClass}
                    />
                </div>
                <div>
                    <label htmlFor="lastName" className={labelClass}>
                        Last name
                    </label>
                    <input
                        type="text"
                        id="lastName"
                        name="lastName"
                        value={values.lastName}
                        onChange={handleChange}
                        autoComplete="family-name"
                        required
                        className={inputClass}
                    />
                </div>
            </div>

            <div className="mb-[18px]">
                <label htmlFor="email" className={labelClass}>
                    Staff email
                </label>
                <input
                    type="email"
                    id="email"
                    name="email"
                    value={values.email}
                    onChange={handleChange}
                    autoComplete="email"
                    required
                    className={inputClass}
                />
            </div>

            <div className="mb-[18px]">
                <label htmlFor="dob" className={labelClass}>
                    Date of birth
                </label>
                <input
                    type="date"
                    id="dob"
                    name="dob"
                    ref={dobRef}
                    value={values.dob}
                    onChange={handleChange}
                    onClick={openPicker}
                    autoComplete="bday"
                    min="1900-01-01"
                    required
                    className={`${inputClass} cursor-pointer`}
                />
            </div>

            <div className="mb-[18px]">
                <label htmlFor="phoneNum" className={labelClass}>
                    Phone No.
                </label>
                <input
                    type="tel"
                    id="phoneNum"
                    name="phoneNum"
                    value={values.phoneNum}
                    onChange={handleChange}
                    autoComplete="tel"
                    placeholder="e.g. +92 300 1234567"
                    required
                    className={inputClass}
                />
            </div>

            <div className="mb-[18px]">
                <label htmlFor="gender" className={labelClass}>
                    Gender
                </label>
                <select
                    id="gender"
                    name="gender"
                    value={values.gender}
                    onChange={handleSelectChange}
                    required
                    className={inputClass}
                >
                    <option value="" disabled>
                        Select gender
                    </option>
                    <option value="MALE">MALE</option>
                    <option value="FEMALE">FEMALE</option>
                    <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                </select>
            </div>

            <div className="mb-[18px]">
                <p className={labelClass}>WhatsApp No.</p>
                <div className="mb-2 flex gap-5">
                    <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                        <input
                            type="radio"
                            name="whatsappOption"
                            id="whatsappSame"
                            checked={whatsappSameAsPhone}
                            onChange={() => handleWhatsappToggle(true)}
                            className="accent-primary"
                        />
                        Same as phone
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5 text-sm">
                        <input
                            type="radio"
                            name="whatsappOption"
                            id="whatsappOther"
                            checked={!whatsappSameAsPhone}
                            onChange={() => handleWhatsappToggle(false)}
                            className="accent-primary"
                        />
                        Other
                    </label>
                </div>
                <input
                    type="tel"
                    id="whatsappNum"
                    name="whatsappNum"
                    value={whatsappSameAsPhone ? values.phoneNum : values.whatsappNum}
                    onChange={handleChange}
                    readOnly={whatsappSameAsPhone}
                    placeholder={whatsappSameAsPhone ? "" : "e.g. +92 300 1234567"}
                    required
                    className={`${inputClass} ${whatsappSameAsPhone ? "cursor-not-allowed opacity-60" : ""}`}
                />
            </div>

            <div className="mb-6">
                <label htmlFor="password" className={labelClass}>
                    Password
                </label>
                <PasswordInput
                    id="password"
                    name="password"
                    value={values.password}
                    onChange={handleChange}
                    autoComplete="new-password"
                />
                <p className="mt-2 text-[12px] text-muted">
                    {PASSWORD_HINT}
                </p>
            </div>

            <button
                type="submit"
                disabled={isLoading}
                className={primaryButtonClass}
            >
                {isLoading ? "Creating account…" : "Create account"}
            </button>
        </form>
    );
}