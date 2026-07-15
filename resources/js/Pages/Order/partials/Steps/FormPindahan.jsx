import React, { useState, useEffect } from "react";
import { usePage } from "@inertiajs/react";
import InputLabel from "@/Components/InputLabel";
import InputError from "@/Components/InputError";
import PrimaryButton from "@/Components/PrimaryButton";
import axios from "axios";
import LiveMap from "@/Components/LiveMap";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
    Truck,
    MapPin,
    Calendar as CalendarIcon,
    Search,
    Loader2,
    Info,
    AlertCircle,
    XCircle,
    ArrowRight,
    Store,
    Moon,
    Clock, // [BARU] Import Icon Clock
} from "lucide-react";

const formatRupiah = (number) => {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(number || 0);
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
            Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(2));
};

export default function FormPindahan({
    product,
    productModelClass,
    blockedDates = [],
    onFormSubmit,
}) {
    const { auth } = usePage().props;
    const excludedDates = blockedDates.map(
        (dateString) => new Date(dateString),
    );

    const [isShopOpen, setIsShopOpen] = useState(true);

    const [data, setData] = useState({
        tanggal_pindahan: "",

        // [BARU] State Waktu Jemput
        pickup_time: "",

        telepon: auth.user.phone || "",
        alamat_penjemputan: "",
        alamat_tujuan: "",
        notes: "",
        origin_latitude: null,
        origin_longitude: null,
        destination_latitude: null,
        destination_longitude: null,
        distance_km: 0,
    });

    const [processing, setProcessing] = useState(false);
    const [errors, setErrors] = useState({});
    const [isSearchingOrigin, setIsSearchingOrigin] = useState(false);
    const [isSearchingDest, setIsSearchingDest] = useState(false);
    const [estimatedTotal, setEstimatedTotal] = useState(
        parseFloat(product.price) || 0,
    );
    const [selectedDate, setSelectedDate] = useState(null);

    const isOverDistanceLimit =
        product.max_distance && data.distance_km > product.max_distance;

    // Effect Cek Jam Operasional
    useEffect(() => {
        const checkOperationalHours = () => {
            const now = new Date();
            const hour = now.getHours();
            if (hour >= 7 && hour < 21) {
                setIsShopOpen(true);
            } else {
                setIsShopOpen(false);
            }
        };
        checkOperationalHours();
        const interval = setInterval(checkOperationalHours, 60000);
        return () => clearInterval(interval);
    }, []);

    // Hitung Harga Pindahan
    useEffect(() => {
        let total = parseFloat(product.price) || 0;
        if (data.origin_latitude && data.destination_latitude) {
            const dist = calculateDistance(
                data.origin_latitude,
                data.origin_longitude,
                data.destination_latitude,
                data.destination_longitude,
            );
            if (data.distance_km !== dist)
                setData((p) => ({ ...p, distance_km: dist }));

            if (dist > 3) {
                const extra = dist - 3;
                total += extra * (parseFloat(product.price_per_km) || 0);
            }
        }
        setEstimatedTotal(Math.ceil(total / 1000) * 1000);
    }, [
        data.origin_latitude,
        data.destination_latitude,
        product.price,
        product.price_per_km,
    ]);

    // Search Helper
    const searchAddress = async (address, setLoading, onSuccess) => {
        if (!address) return alert("Isi alamat!");
        setLoading(true);
        try {
            let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=id`;
            let res = await fetch(url);
            let result = await res.json();
            if (result.length === 0) {
                const parts = address.split(",");
                if (parts.length > 1) {
                    url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(parts.slice(0, 2).join(",") + ", Indonesia")}&limit=1&countrycodes=id`;
                    res = await fetch(url);
                    result = await res.json();
                }
            }
            if (result.length > 0)
                onSuccess(parseFloat(result[0].lat), parseFloat(result[0].lon));
            else alert("Alamat tidak ditemukan.");
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const submit = (e) => {
        e.preventDefault();

        if (!isShopOpen) return;

        setProcessing(true);
        setErrors({});

        if (blockedDates.includes(data.tanggal_pindahan)) {
            setErrors({ "form_details.tanggal_pindahan": ["Tanggal penuh."] });
            setProcessing(false);
            return;
        }

        // [BARU] Validasi Jam Jemput
        if (!data.pickup_time) {
            setErrors({
                "form_details.pickup_time": ["Jam penjemputan wajib diisi."],
            });
            setProcessing(false);
            return;
        }
        const [hour] = data.pickup_time.split(":");
        if (parseInt(hour) < 7 || parseInt(hour) >= 21) {
            setErrors({
                "form_details.pickup_time": [
                    "Jam penjemputan hanya antara 07:00 - 21:00 WIB.",
                ],
            });
            setProcessing(false);
            return;
        }

        if (!data.origin_latitude || !data.destination_latitude) {
            alert("Harap cari lokasi Asal & Tujuan.");
            setProcessing(false);
            return;
        }
        if (isOverDistanceLimit) {
            alert("Jarak melebihi batas.");
            setProcessing(false);
            return;
        }

        const formData = new FormData();
        formData.append("product_id", product.id);
        formData.append("product_model", productModelClass);
        formData.append("final_amount", estimatedTotal);
        Object.keys(data).forEach((key) =>
            formData.append(
                `form_details[${key}]`,
                data[key] === null ? "" : data[key],
            ),
        );

        axios
            .post(route("order.store"), formData, {
                headers: { "Content-Type": "multipart/form-data" },
            })
            .then((res) => onFormSubmit(res.data.order))
            .catch((err) => {
                if (err.response?.status === 422)
                    setErrors(err.response.data.errors);
                else if (err.response?.status === 403)
                    alert(err.response.data.message);
                else alert("Terjadi kesalahan.");
            })
            .finally(() => setProcessing(false));
    };

    return (
        <form onSubmit={submit} className="space-y-6 animate-in fade-in">
            <style>{`
                .react-datepicker__day--disabled { color: #ccc !important; background-color: #f3f4f6 !important; text-decoration: line-through; cursor: not-allowed; }
                .react-datepicker-wrapper { width: 100%; }
                /* Custom Time Input */
                input[type="time"]::-webkit-calendar-picker-indicator { cursor: pointer; }
            `}</style>

            <div className="sm:hidden flex justify-between items-center bg-gray-50 p-4 rounded-xl border border-gray-200">
                <span className="text-sm font-bold text-gray-500 uppercase">
                    Total Estimasi
                </span>
                <span className="text-xl font-black text-emerald-600">
                    {formatRupiah(estimatedTotal)}
                </span>
            </div>

            {/* --- BANNER TOKO TUTUP --- */}
            {!isShopOpen && (
                <div className="p-4 bg-gray-800 text-white rounded-2xl shadow-xl border border-gray-700 animate-in slide-in-from-top-5">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-gray-700 rounded-full">
                            <Moon size={24} className="text-yellow-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold">
                                Layanan Sedang Tutup
                            </h3>
                            <p className="text-sm text-gray-300 mt-1">
                                Operasional kami pukul{" "}
                                <span className="font-bold text-white">
                                    07:00 - 21:00 WIB
                                </span>
                                . Silakan kembali lagi besok pagi ya, bor!
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Area Form */}
            <div
                className={`${!isShopOpen ? "opacity-50 pointer-events-none grayscale" : ""} transition-all duration-500`}
            >
                {/* Section Tanggal & Waktu */}
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Tanggal */}
                        <div className="relative z-50">
                            <InputLabel value="Tanggal Pindahan" />
                            <div className="relative mt-1">
                                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
                                <DatePicker
                                    selected={selectedDate}
                                    onChange={(date) => {
                                        setSelectedDate(date);
                                        if (date) {
                                            const offset =
                                                date.getTimezoneOffset();
                                            const local = new Date(
                                                date.getTime() -
                                                    offset * 60 * 1000,
                                            );
                                            setData((p) => ({
                                                ...p,
                                                tanggal_pindahan: local
                                                    .toISOString()
                                                    .split("T")[0],
                                            }));
                                        }
                                    }}
                                    minDate={new Date()}
                                    excludeDates={excludedDates}
                                    dateFormat="dd MMMM yyyy"
                                    placeholderText="Pilih tanggal..."
                                    className="w-full pl-10 border-gray-300 rounded-xl focus:ring-blue-500 focus:border-blue-500 cursor-pointer shadow-sm"
                                    onKeyDown={(e) => e.preventDefault()}
                                />
                            </div>
                            {blockedDates.length > 0 && (
                                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1 bg-amber-50 p-2 rounded-lg border border-amber-100">
                                    <Info size={12} />
                                    <span>
                                        Beberapa tanggal sudah penuh (diarsir).
                                    </span>
                                </p>
                            )}
                            <InputError
                                message={
                                    errors["form_details.tanggal_pindahan"]?.[0]
                                }
                            />
                        </div>

                        {/* [BARU] Input Jam Jemput */}
                        <div>
                            <InputLabel value="Waktu Mulai Angkut (07:00 - 21:00)" />
                            <div className="relative mt-1">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                    <Clock className="w-4 h-4" />
                                </div>
                                <input
                                    type="time"
                                    min="07:00"
                                    max="21:00"
                                    value={data.pickup_time}
                                    onChange={(e) =>
                                        setData((p) => ({
                                            ...p,
                                            pickup_time: e.target.value,
                                        }))
                                    }
                                    className="pl-10 w-full border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <InputError
                                message={
                                    errors["form_details.pickup_time"]?.[0]
                                }
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <InputLabel value="No WhatsApp" />
                            <input
                                type="tel"
                                value={data.telepon}
                                onChange={(e) =>
                                    setData((p) => ({
                                        ...p,
                                        telepon: e.target.value,
                                    }))
                                }
                                className="mt-1 w-full border-gray-300 rounded-xl shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                placeholder="08xxx"
                            />
                            <InputError
                                message={errors["form_details.telepon"]?.[0]}
                            />
                        </div>
                    </div>
                </div>

                {/* Lokasi Asal */}
                <div className="space-y-4 bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100 mt-6">
                    <div>
                        <InputLabel
                            value="Alamat Asal (Titik Jemput)"
                            className="text-emerald-800"
                        />
                        <textarea
                            value={data.alamat_penjemputan}
                            onChange={(e) =>
                                setData((p) => ({
                                    ...p,
                                    alamat_penjemputan: e.target.value,
                                }))
                            }
                            rows="2"
                            className="w-full border-emerald-200 rounded-xl text-sm mb-2 focus:ring-emerald-500 focus:border-emerald-500"
                            placeholder="Alamat asal..."
                        ></textarea>
                        <button
                            type="button"
                            onClick={() =>
                                searchAddress(
                                    data.alamat_penjemputan,
                                    setIsSearchingOrigin,
                                    (lat, lng) =>
                                        setData((p) => ({
                                            ...p,
                                            origin_latitude: lat,
                                            origin_longitude: lng,
                                        })),
                                )
                            }
                            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm flex justify-center gap-2 transition-all shadow-sm"
                        >
                            {isSearchingOrigin ? (
                                <Loader2 className="animate-spin" />
                            ) : (
                                <Search />
                            )}{" "}
                            Cari Lokasi Asal
                        </button>
                    </div>
                    {data.origin_latitude && (
                        <div className="h-48 w-full rounded-xl border border-gray-300 overflow-hidden relative shadow-inner">
                            <LiveMap
                                readOnly={true}
                                lat={data.origin_latitude}
                                lng={data.origin_longitude}
                                onLocationSelect={() => {}}
                            />
                            <div className="absolute top-2 right-2 bg-white px-3 py-1 rounded-full text-xs font-bold shadow text-emerald-700 flex items-center gap-1">
                                <MapPin size={12} /> Asal
                            </div>
                        </div>
                    )}
                </div>

                {/* Lokasi Tujuan */}
                <div className="space-y-4 bg-blue-50/50 p-5 rounded-2xl border border-blue-100 mt-6">
                    <div>
                        <InputLabel
                            value="Alamat Tujuan (Titik Antar)"
                            className="text-blue-800"
                        />
                        <textarea
                            value={data.alamat_tujuan}
                            onChange={(e) =>
                                setData((p) => ({
                                    ...p,
                                    alamat_tujuan: e.target.value,
                                }))
                            }
                            rows="2"
                            className="w-full border-blue-200 rounded-xl text-sm mb-2 focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Alamat tujuan..."
                        ></textarea>
                        <button
                            type="button"
                            onClick={() =>
                                searchAddress(
                                    data.alamat_tujuan,
                                    setIsSearchingDest,
                                    (lat, lng) =>
                                        setData((p) => ({
                                            ...p,
                                            destination_latitude: lat,
                                            destination_longitude: lng,
                                        })),
                                )
                            }
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm flex justify-center gap-2 transition-all shadow-sm"
                        >
                            {isSearchingDest ? (
                                <Loader2 className="animate-spin" />
                            ) : (
                                <Search />
                            )}{" "}
                            Cari Lokasi Tujuan
                        </button>
                    </div>
                    {data.destination_latitude && (
                        <div className="h-48 w-full rounded-xl border border-gray-300 overflow-hidden relative shadow-inner">
                            <LiveMap
                                readOnly={true}
                                lat={data.destination_latitude}
                                lng={data.destination_longitude}
                                onLocationSelect={() => {}}
                            />
                            <div className="absolute top-2 right-2 bg-white px-3 py-1 rounded-full text-xs font-bold shadow text-blue-700 flex items-center gap-1">
                                <MapPin size={12} /> Tujuan
                            </div>
                        </div>
                    )}
                </div>

                {data.distance_km > 0 && (
                    <div
                        className={`p-4 rounded-xl flex gap-3 items-center border shadow-sm mt-4 ${isOverDistanceLimit ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}`}
                    >
                        <div
                            className={`p-2 rounded-full ${isOverDistanceLimit ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"}`}
                        >
                            {isOverDistanceLimit ? (
                                <XCircle size={20} />
                            ) : (
                                <Truck size={20} />
                            )}
                        </div>
                        <div className="text-sm text-gray-700">
                            <span
                                className={`font-bold block text-lg ${isOverDistanceLimit ? "text-red-700" : "text-gray-800"}`}
                            >
                                {data.distance_km} KM
                            </span>
                            <span className="opacity-80">
                                {isOverDistanceLimit
                                    ? `Melebihi batas (${product.max_distance} KM).`
                                    : "Estimasi jarak tempuh."}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            <div className="pt-4 border-t border-gray-100">
                <PrimaryButton
                    disabled={processing || isOverDistanceLimit || !isShopOpen}
                    className={`w-full justify-center py-4 text-base font-bold rounded-xl shadow-xl transition-all ${
                        !isShopOpen
                            ? "bg-gray-400 cursor-not-allowed shadow-none"
                            : "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-200 hover:-translate-y-1"
                    }`}
                >
                    {processing ? (
                        "Memproses..."
                    ) : (
                        <span className="flex items-center">
                            {isShopOpen ? (
                                <>
                                    Lanjut Pembayaran{" "}
                                    <ArrowRight className="ml-2 w-5 h-5" />
                                </>
                            ) : (
                                <>
                                    Toko Tutup{" "}
                                    <Store className="ml-2 w-5 h-5" />
                                </>
                            )}
                        </span>
                    )}
                </PrimaryButton>
            </div>
        </form>
    );
}
