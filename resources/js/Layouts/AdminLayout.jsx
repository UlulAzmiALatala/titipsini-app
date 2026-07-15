import React, { useState } from "react";
import { Link } from "@inertiajs/react";
import AdminSidebar from "./Partials/AdminSidebar";
import { Menu, X, LogOut, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import NotificationDropdown from "@/Components/NotificationDropdown";

export default function AdminLayout({ user, header, children }) {
    const [isSidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="relative flex h-screen bg-[#f8fafc] text-slate-900 overflow-hidden font-sans">
            {/* Sidebar untuk Desktop */}
            <div className="hidden md:flex z-20">
                <AdminSidebar />
            </div>

            {/* Sidebar untuk Mobile */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <>
                        {/* Overlay dengan efek blur */}
                        <motion.div
                            className="fixed inset-0 bg-[#0f172a]/60 backdrop-blur-sm z-40 md:hidden"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSidebarOpen(false)}
                        />

                        {/* Sidebar Slide (Dark Theme menyesuaikan AdminSidebar) */}
                        <motion.div
                            className="fixed z-50 inset-y-0 left-0 w-[260px] bg-[#0b1120] shadow-2xl md:hidden flex flex-col border-r border-[#1e293b]/80"
                            initial={{ x: "-100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "-100%" }}
                            transition={{
                                type: "spring",
                                bounce: 0,
                                duration: 0.4,
                            }}
                        >
                            <div className="flex justify-end items-center px-4 h-16 border-b border-[#1e293b]/80">
                                <button
                                    onClick={() => setSidebarOpen(false)}
                                    className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#1e293b] transition-all"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                <AdminSidebar />
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Konten Utama */}
            <div className="flex-1 flex flex-col overflow-hidden relative">
                {/* Navbar */}
                <header className="bg-white/70 backdrop-blur-xl shadow-[0_4px_30px_rgba(0,0,0,0.02)] sticky top-0 z-30 border-b border-slate-200/60">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center justify-between h-16 md:h-20">
                            {/* Bagian Kiri: Tombol Mobile & Judul Halaman */}
                            <div className="flex items-center gap-4">
                                <div className="md:hidden">
                                    <button
                                        onClick={() =>
                                            setSidebarOpen(!isSidebarOpen)
                                        }
                                        className="p-2 -ml-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-all"
                                    >
                                        <Menu size={24} />
                                    </button>
                                </div>

                                <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.4, delay: 0.1 }}
                                >
                                    {header ? (
                                        <div className="font-bold text-lg md:text-xl text-slate-800 tracking-tight">
                                            {header}
                                        </div>
                                    ) : (
                                        <div className="font-bold text-lg md:text-xl text-slate-800 tracking-tight">
                                            Dashboard Panel
                                        </div>
                                    )}
                                </motion.div>
                            </div>

                            {/* Bagian Kanan: User Info, Notifikasi & Logout */}
                            <div className="flex items-center gap-2 md:gap-4">
                                <NotificationDropdown />

                                {/* Garis pemisah vertikal */}
                                <div className="h-6 w-px bg-slate-200 hidden sm:block mx-1"></div>

                                <motion.div
                                    className="hidden sm:flex items-center gap-3 bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-sm"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.2 }}
                                >
                                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-white shadow-inner">
                                        <User size={14} strokeWidth={2.5} />
                                    </div>
                                    <span className="text-sm font-semibold text-slate-700 pr-2">
                                        {user ? user.name : "Administrator"}
                                    </span>
                                </motion.div>

                                <Link
                                    href={route("logout")}
                                    method="post"
                                    as="button"
                                    className="group flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-500 rounded-xl hover:bg-red-50 hover:text-red-600 transition-all"
                                >
                                    <LogOut
                                        size={18}
                                        className="group-hover:scale-110 transition-transform"
                                    />
                                    <span className="hidden lg:inline">
                                        Logout
                                    </span>
                                </Link>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Area Konten */}
                <motion.main
                    className="flex-1 overflow-y-auto"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5 }}
                >
                    {/* Background Ornament Lembut */}
                    <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-slate-100 to-transparent -z-10 pointer-events-none"></div>

                    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ duration: 0.4, delay: 0.1 }}
                            className="min-h-[calc(100vh-12rem)]"
                        >
                            {children}
                        </motion.div>
                    </div>
                </motion.main>
            </div>
        </div>
    );
}
