"use client"; // it owns the show/hide state

import { useState } from "react";
import EyeIcon from "./eyeicon";
import { inputBase } from "./styles";

type Props = {
    id: string;
    name: string;
    value: string;
    onChange: React.ChangeEventHandler<HTMLInputElement>;
    onBlur?: React.FocusEventHandler<HTMLInputElement>;
    autoComplete: "current-password" | "new-password";
    ariaInvalid?: boolean;
    ariaDescribedBy?: string;
    hasError?: boolean;
    disabled?: boolean;
    maxLength?: number;
};

export default function PasswordInput({
    id,
    name,
    value,
    onChange,
    onBlur,
    autoComplete,
    ariaInvalid,
    ariaDescribedBy,
    hasError,
    disabled,
    maxLength,
}: Props) {
    const [show, setShow] = useState(false);

    return (
        <div className="relative">
            {/* pr-12 keeps long passwords from running under the icon. */}
            <input
                type={show ? "text" : "password"}
                id={id}
                name={name}
                value={value}
                onChange={onChange}
                onBlur={onBlur}
                autoComplete={autoComplete}
                aria-invalid={ariaInvalid}
                aria-describedby={ariaDescribedBy}
                disabled={disabled}
                maxLength={maxLength}
                required
                className={`${inputBase} pl-[15px] pr-12 ${
                    hasError ? "border-[#B42318] focus:border-[#B42318] focus:ring-[#B42318]" : ""
                }`}
            />
            {/* type="button" stops this from submitting the surrounding form. Touch target >= 44px */}
            <button
                type="button"
                onClick={() => setShow((prev) => !prev)}
                aria-label={show ? "Hide password" : "Show password"}
                aria-pressed={show}
                disabled={disabled}
                className="absolute right-1 top-1/2 -translate-y-1/2 flex min-h-[44px] min-w-[44px] items-center justify-center text-field-label hover:text-card-foreground focus-visible:outline-2 focus-visible:outline-focus cursor-pointer"
            >
                <EyeIcon off={show} />
            </button>
        </div>
    );
}