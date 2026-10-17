"use client"; // it owns the show/hide state

import { useState } from "react";
import EyeIcon from "./eyeicon";
import { inputBase } from "./styles";

type Props = {
    id: string;
    name: string;
    value: string;
    // The standard change-event type, so it works with a generic handler that reads e.target.name.
    onChange: React.ChangeEventHandler<HTMLInputElement>;
    // Restricting the type to these two values catches typos at compile time.
    autoComplete: "current-password" | "new-password";
};

export default function PasswordInput({
    id,
    name,
    value,
    onChange,
    autoComplete,
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
                autoComplete={autoComplete}
                required
                className={`${inputBase} pl-[15px] pr-12`}
            />
            {/* type="button" stops this from submitting the surrounding form. */}
            <button
                type="button"
                onClick={() => setShow((prev) => !prev)}
                aria-label={show ? "Hide password" : "Show password"}
                aria-pressed={show}
                className="absolute right-[5px] top-1/2 -translate-y-1/2 text-field-label hover:text-card-foreground"
            >
                <EyeIcon off={show} />
            </button>
        </div>
    );
}