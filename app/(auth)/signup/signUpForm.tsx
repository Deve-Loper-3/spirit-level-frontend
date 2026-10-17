"use client";

import { useRef, useState } from "react";
import PasswordInput from "@/components/(auth)/PasswordInput";
import {
    inputClass,
    labelClass,
    primaryButtonClass,
} from "@/components/(auth)/styles";



// Today's date as "YYYY-MM-DD" in the user's LOCAL time.
// Don't use new Date().toISOString().slice(0, 10): that is the UTC date,
// which can be a day off near midnight.
function todayISO() {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${month}-${day}`;
}

export default function SignUpForm() {
    // One state object for all fields, instead of five separate useState calls.
    const [values, setValues] = useState({
        firstName: "",
        lastName: "",
        email: "",
        dob: "",
        phoneNum: "",
        gender: "",
        // whatsappNum stores a custom number only when whatsappSameAsPhone is false.
        // When true, the phone number is reused at submit time — no duplication needed.
        whatsappNum: "",
        password: "",
    });
    // Tracks whether WhatsApp == phone. Separate from `values` because it isn't
    // a form field that gets submitted — it's purely a UI toggle.
    const [whatsappSameAsPhone, setWhatsappSameAsPhone] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const dobRef = useRef<HTMLInputElement>(null);

    // One handler for every field. It reads the input's `name` attribute and updates the
    // matching key, which is why each input's `name` must match a key in `values`.
    // [name] is a computed property key. The spread copies the other fields unchanged.
    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const { name, value } = e.target;
        setValues((prev) => ({ ...prev, [name]: value }));
    }

    // Same pattern as handleChange but for <select> elements.
    function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
        const { name, value } = e.target;
        setValues((prev) => ({ ...prev, [name]: value }));
    }

    // Handles the "Same as phone" / "Other" radio toggle for WhatsApp.
    // Switching to "same" clears any previously typed custom number so the
    // field resets cleanly if the user switches back.
    function handleWhatsappToggle(same: boolean) {
        setWhatsappSameAsPhone(same);
        if (same) setValues((prev) => ({ ...prev, whatsappNum: "" }));
    }

    // Opens the calendar when the user clicks anywhere in the field, not just on the icon.
    // showPicker() needs a user gesture (a click is one) and can throw in some browsers,
    // so it's wrapped in try/catch. If the calendar flickers shut when you click the
    // built-in icon, remove the onClick on the date input.
    function openPicker() {
        try {
            dobRef.current?.showPicker();
        } catch {
            // Ignore: the user can still use the browser's own icon or type the date.
        }
    }

    // Returns an error message, or "" if everything is valid.
    // Dates in "YYYY-MM-DD" form compare correctly as plain strings.
    function validate() {
        if (values.dob > todayISO()) return "Date of birth can't be in the future.";
        if (values.password.length < 8)
            return "Password must be at least 8 characters.";
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

            const data = await res.json() as { message: string };
            if (!res.ok) {
                setError(data.message ?? "Something went wrong. Please try again.");
                return;
            }

            // Redirect to login after successful account creation
            window.location.href = "/login?registered=true";
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

            {/* Names: stacked on mobile, two columns from 640px up. The grid's gap handles
          spacing, so the cells need no margins of their own. */}
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
                {/* type="date" gives the mini calendar for free. The value is always
            "YYYY-MM-DD", whatever format the browser displays. */}
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
                {/* type="tel" is correct for phone numbers: it shows a numeric
                keyboard on mobile, allows + for country codes, and preserves
                leading zeros. type="number" strips leading zeros and adds
                unwanted spin buttons. */}
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
                {/* Radio toggle -------------------------------------------------- */}
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
                {/* Number input — shown always, read-only when mirroring phone */}
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
                {/* new-password tells password managers to offer a NEW strong password,
            where login uses current-password to offer a saved one. */}
                <PasswordInput
                    id="password"
                    name="password"
                    value={values.password}
                    onChange={handleChange}
                    autoComplete="new-password"
                />
                <p className="mt-2 text-[12px] text-muted">
                    At least 8 characters.
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