import React, { useState } from "react";
import { Link } from "@inertiajs/react";
import {
    LayoutDashboard,
    Settings,
    ChevronDown,
    ClipboardList,
    Users,
    ShieldCheck,
    Truck,
    CreditCard,
    MapPin,
    Package,
    Box,
    Layers,
    Phone,
    Share2,
    Image as ImageIcon,
    UserCircle,
    UserCheck,
    Wallet,
} from "lucide-react";

// --- KOMPONEN-KOMPONEN KECIL (HELPER) ---

const SidebarLink = ({ href, active, children, icon }) => (
    <Link
        href={href}
        className={`group relative flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 ${
            active
                ? "bg-gradient-to-r from-amber-500/10 to-amber-500/5 text-amber-400 shadow-[inset_4px_0_0_0_#fbbf24]"
                : "text-gray-400 hover:bg-[#1e293b] hover:text-gray-200"
        }`}
    >
        <span
            className={`mr-3 flex items-center justify-center transition-colors duration-200 ${
                active
                    ? "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                    : "text-gray-500 group-hover:text-amber-200/70"
            }`}
        >
            {icon}
        </span>
        {children}
    </Link>
);

const SidebarSubLink = ({ href, active, children, icon }) => (
    <Link
        href={href}
        className={`group flex items-center pl-12 pr-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
            active
                ? "bg-[#1e293b]/80 text-amber-400"
                : "text-gray-400 hover:bg-[#1e293b]/50 hover:text-gray-200"
        }`}
    >
        {icon && (
            <span
                className={`mr-2.5 ${active ? "text-amber-400" : "text-gray-500 group-hover:text-gray-300"}`}
            >
                {icon}
            </span>
        )}
        {children}
    </Link>
);

const SidebarDropdown = ({
    title,
    icon,
    active,
    isOpen,
    onToggle,
    children,
}) => (
    <div className="mb-1">
        <button
            onClick={onToggle}
            className={`group w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-300 ${
                active
                    ? "bg-gradient-to-r from-amber-500/10 to-amber-500/5 text-amber-400 shadow-[inset_4px_0_0_0_#fbbf24]"
                    : "text-gray-400 hover:bg-[#1e293b] hover:text-gray-200"
            }`}
        >
            <span
                className={`mr-3 flex items-center justify-center ${
                    active
                        ? "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]"
                        : "text-gray-500 group-hover:text-amber-200/70"
                }`}
            >
                {icon}
            </span>
            <span className="flex-1 text-left">{title}</span>
            <ChevronDown
                className={`h-4 w-4 transform transition-transform duration-300 ${
                    isOpen ? "rotate-180 text-amber-400" : "text-gray-500"
                }`}
            />
        </button>
        <div
            className={`grid transition-all duration-300 ease-in-out ${
                isOpen
                    ? "grid-rows-[1fr] opacity-100 mt-1.5"
                    : "grid-rows-[0fr] opacity-0"
            }`}
        >
            <div className="overflow-hidden space-y-1">{children}</div>
        </div>
    </div>
);

// --- KOMPONEN UTAMA SIDEBAR ---

export default function AdminSidebar() {
    // Pengelompokan State Dropdown yang lebih ringkas dan logis
    const [openDropdown, setOpenDropdown] = useState({
        pesanan:
            route().current("admin.orders.*") ||
            route().current("admin.pindahan.*") ||
            route().current("admin.payment_settings.*"),
        operasional:
            route().current("admin.branches.*") ||
            route().current("admin.services.*") ||
            route().current("admin.moving-packages.*"),
        pengguna:
            route().current("admin.users.*") ||
            route().current("admin.verification.*") ||
            route().current("admin.courier_verifications.*"),
        pengaturan: route().current("admin.settings.*"),
    });

    const handleToggle = (dropdown) => {
        setOpenDropdown((prev) => ({ ...prev, [dropdown]: !prev[dropdown] }));
    };

    return (
        <aside className="w-[260px] min-h-screen bg-[#0b1120] text-gray-200 flex flex-col border-r border-[#1e293b]/80 shadow-2xl z-20">
            {/* Header Logo */}
            <div className="h-16 flex items-center justify-center bg-[#0b1120] border-b border-[#1e293b]/80 sticky top-0 z-10">
                <Link
                    href={route("dashboard")}
                    className="flex items-center gap-2 text-amber-400 font-bold text-lg tracking-wider hover:text-amber-300 transition-colors"
                >
                    <Package className="h-6 w-6 text-amber-500" />
                    <span>
                        TITIPSINI<span className="text-white">ADMIN</span>
                    </span>
                </Link>
            </div>

            {/* Navigasi Utama */}
            <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-[#1e293b] [&::-webkit-scrollbar-thumb]:rounded-full">
                {/* --- DASHBOARD --- */}
                <div className="mb-4">
                    <SidebarLink
                        href={route("dashboard")}
                        active={route().current("dashboard")}
                        icon={<LayoutDashboard className="h-5 w-5" />}
                    >
                        Dashboard
                    </SidebarLink>
                </div>

                <div className="px-4 pb-2 pt-1 text-[10px] font-extrabold tracking-wider text-gray-500 uppercase">
                    Modul Utama
                </div>

                {/* --- 1. PESANAN & KEUANGAN --- */}
                <SidebarDropdown
                    title="Pesanan & Keuangan"
                    icon={<ClipboardList className="h-5 w-5" />}
                    active={
                        route().current("admin.orders.*") ||
                        route().current("admin.pindahan.*") ||
                        route().current("admin.payment_settings.*")
                    }
                    isOpen={openDropdown.pesanan}
                    onToggle={() => handleToggle("pesanan")}
                >
                    <SidebarSubLink
                        href={route("admin.orders.index")}
                        active={route().current("admin.orders.*")}
                        icon={<Package className="h-4 w-4" />}
                    >
                        Pesanan Penitipan
                    </SidebarSubLink>
                    <SidebarSubLink
                        href={route("admin.pindahan.index")}
                        active={route().current("admin.pindahan.*")}
                        icon={<Truck className="h-4 w-4" />}
                    >
                        Pesanan Pindahan
                    </SidebarSubLink>
                    <SidebarSubLink
                        href={route("admin.payment_settings.index")}
                        active={route().current("admin.payment_settings.*")}
                        icon={<Wallet className="h-4 w-4" />}
                    >
                        Rekening Transfer
                    </SidebarSubLink>
                </SidebarDropdown>

                {/* --- 2. DATA MASTER & LAYANAN --- */}
                <SidebarDropdown
                    title="Master & Layanan"
                    icon={<Layers className="h-5 w-5" />}
                    active={
                        route().current("admin.branches.*") ||
                        route().current("admin.services.*") ||
                        route().current("admin.moving-packages.*")
                    }
                    isOpen={openDropdown.operasional}
                    onToggle={() => handleToggle("operasional")}
                >
                    <SidebarSubLink
                        href={route("admin.branches.index")}
                        active={route().current("admin.branches.*")}
                        icon={<MapPin className="h-4 w-4" />}
                    >
                        Manajemen Cabang
                    </SidebarSubLink>
                    <SidebarSubLink
                        href={route("admin.services.index")}
                        active={route().current("admin.services.*")}
                        icon={<Layers className="h-4 w-4" />}
                    >
                        Layanan Umum (Home)
                    </SidebarSubLink>
                    <SidebarSubLink
                        href={route("admin.moving-packages.index")}
                        active={route().current("admin.moving-packages.*")}
                        icon={<Box className="h-4 w-4" />}
                    >
                        Paket Pindahan
                    </SidebarSubLink>
                </SidebarDropdown>

                {/* --- 3. MANAJEMEN PENGGUNA --- */}
                <SidebarDropdown
                    title="Manajemen Pengguna"
                    icon={<Users className="h-5 w-5" />}
                    active={
                        route().current("admin.users.*") ||
                        route().current("admin.verification.*") ||
                        route().current("admin.courier_verifications.*")
                    }
                    isOpen={openDropdown.pengguna}
                    onToggle={() => handleToggle("pengguna")}
                >
                    <SidebarSubLink
                        href={route("admin.users.index")}
                        active={route().current("admin.users.*")}
                        icon={<UserCircle className="h-4 w-4" />}
                    >
                        Data Pengguna
                    </SidebarSubLink>
                    <SidebarSubLink
                        href={route("admin.verification.index")}
                        active={route().current("admin.verification.*")}
                        icon={<ShieldCheck className="h-4 w-4" />}
                    >
                        Verifikasi Klien
                    </SidebarSubLink>
                    <SidebarSubLink
                        href={route("admin.courier_verifications.index")}
                        active={route().current(
                            "admin.courier_verifications.*",
                        )}
                        icon={<UserCheck className="h-4 w-4" />}
                    >
                        Verifikasi Kurir
                    </SidebarSubLink>
                </SidebarDropdown>

                <div className="px-4 pb-2 pt-4 text-[10px] font-extrabold tracking-wider text-gray-500 uppercase">
                    Konfigurasi
                </div>

                {/* --- 4. PENGATURAN WEBSITE --- */}
                <SidebarDropdown
                    title="Pengaturan Web"
                    icon={<Settings className="h-5 w-5" />}
                    active={route().current("admin.settings.*")}
                    isOpen={openDropdown.pengaturan}
                    onToggle={() => handleToggle("pengaturan")}
                >
                    <SidebarSubLink
                        href={route("admin.settings.contact")}
                        active={route().current("admin.settings.contact")}
                        icon={<Phone className="h-4 w-4" />}
                    >
                        Info Kontak
                    </SidebarSubLink>
                    <SidebarSubLink
                        href={route("admin.settings.social")}
                        active={route().current("admin.settings.social")}
                        icon={<Share2 className="h-4 w-4" />}
                    >
                        Media Sosial
                    </SidebarSubLink>
                    <SidebarSubLink
                        href={route("admin.settings.logo")}
                        active={route().current("admin.settings.logo")}
                        icon={<ImageIcon className="h-4 w-4" />}
                    >
                        Logo Web
                    </SidebarSubLink>
                </SidebarDropdown>
            </nav>

            {/* Footer Sidebar */}
            <div className="p-4 border-t border-[#1e293b]/80 bg-[#0b1120]">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-[#0b1120] font-bold shadow-md">
                        A
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-gray-200">
                            Administrator
                        </p>
                        <p className="text-[10px] text-gray-500">
                            Titipsini System
                        </p>
                    </div>
                </div>
            </div>
        </aside>
    );
}
