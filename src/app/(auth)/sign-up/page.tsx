"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
// Importa tu cliente de better-auth
import { authClient } from "@/lib/auth-client";

export default function SignUpPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            // --- LÓGICA DE BETTER-AUTH PARA SIGN UP ---

            const { data, error: signUpError } = await authClient.signUp.email({
                email,
                password,
                name,
            });

            if (signUpError) throw new Error(signUpError.message);

            router.push("/");

        } catch (err: any) {
            setError(err.message || "Ocurrió un error al crear la cuenta");
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F9FAFB] flex flex-col font-sans">

            <main className="flex-1 flex items-center justify-center p-6">
                <div className="w-full max-w-[420px] bg-white rounded-[20px] border border-gray-100 p-8 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)]">

                    <div className="mb-8 text-center">
                        <h2 className="text-2xl font-bold text-gray-900">Crear Cuenta</h2>
                        <p className="text-sm text-gray-500 mt-2">
                            Completa tus datos para registrarte en la plataforma
                        </p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-700">
                                Nombre completo
                            </label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0F172A] focus:border-transparent transition-all"
                                placeholder="Ej. Juan Pérez"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-700">
                                Teléfono
                            </label>
                            <input
                                type="tel"
                                required
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0F172A] focus:border-transparent transition-all"
                                placeholder="+56 9 1234 5678"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-700">
                                Correo Electrónico
                            </label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0F172A] focus:border-transparent transition-all"
                                placeholder="correo@ejemplo.com"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-700">
                                Contraseña
                            </label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#0F172A] focus:border-transparent transition-all"
                                placeholder="••••••••"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full mt-6 bg-[#0F172A] hover:bg-[#1E293B] text-white py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-70 flex items-center justify-center"
                        >
                            {isLoading ? (
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            ) : (
                                "Registrarse"
                            )}
                        </button>
                    </form>

                    <div className="mt-8 text-center text-sm text-gray-500">
                        ¿Ya tienes una cuenta?{" "}
                        <Link href="/sign-in" className="font-semibold text-[#0F172A] hover:underline">
                            Inicia sesión
                        </Link>
                    </div>
                </div>
            </main>
        </div>
    );
}