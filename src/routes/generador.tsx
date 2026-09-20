import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";

export const Route = createFileRoute("/generador")({
  component: Generador,
});

type Guest = {
  id: string;
  nombre: string;
  pases: number;
};

const STORAGE_KEY = "boda-invitados";

function buildLink(base: string, guest: Guest) {
  const url = new URL(base || window.location.origin);
  url.search = "";
  url.searchParams.set("invitado", guest.nombre);
  url.searchParams.set("pases", String(guest.pases));
  return url.toString();
}

function Generador() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [baseUrl, setBaseUrl] = useState("");
  const [nombre, setNombre] = useState("");
  const [pases, setPases] = useState(2);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // The list lives in this browser only — no backend, nothing to deploy.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { guests?: Guest[]; baseUrl?: string };
        if (Array.isArray(parsed.guests)) setGuests(parsed.guests);
        if (parsed.baseUrl) setBaseUrl(parsed.baseUrl);
        else setBaseUrl(window.location.origin);
      } else {
        setBaseUrl(window.location.origin);
      }
    } catch {
      setBaseUrl(window.location.origin);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ guests, baseUrl }));
    } catch {
      // Private mode or a full quota: the page still works, it just won't
      // remember the list next time.
    }
  }, [guests, baseUrl, loaded]);

  const totalPersonas = useMemo(() => guests.reduce((sum, g) => sum + g.pases, 0), [guests]);

  const addGuest = (e: FormEvent) => {
    e.preventDefault();
    const clean = nombre.trim();
    if (!clean) return;
    setGuests((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, nombre: clean, pases },
    ]);
    setNombre("");
  };

  const removeGuest = (id: string) => setGuests((prev) => prev.filter((g) => g.id !== id));

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1600);
    } catch {
      window.prompt("Copia el enlace:", text);
    }
  };

  const copyAll = () => {
    const text = guests
      .map((g) => `${g.nombre} (${g.pases === 1 ? "1 espacio" : `${g.pases} espacios`}): ${buildLink(baseUrl, g)}`)
      .join("\n");
    copy(text, "all");
  };

  const whatsappHref = (guest: Guest) => {
    const link = buildLink(baseUrl, guest);
    const msg =
      `¡Hola ${guest.nombre}! Con mucho cariño te compartimos nuestra invitación de boda. ` +
      `Ábrela aquí: ${link}`;
    return `https://wa.me/?text=${encodeURIComponent(msg)}`;
  };

  const inputStyle = {
    fontFamily: "'Inter', sans-serif",
    borderColor: "rgba(150,105,30,0.3)",
    color: "#2a1f14",
  } as const;

  return (
    <main className="min-h-screen px-4 py-12" style={{ background: "#FFF9EF" }}>
      <div className="mx-auto max-w-3xl">
        <header className="text-center">
          <span
            className="text-[12px] uppercase tracking-[0.34em]"
            style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, color: "var(--wax-gold-dark)" }}
          >
            Solo para los novios
          </span>
          <h1
            className="mt-1 text-6xl sm:text-7xl"
            style={{ fontFamily: "'Tangerine', cursive", fontWeight: 700, color: "#2a1f14", lineHeight: 1.1 }}
          >
            Invitaciones personalizadas
          </h1>
          <p className="mt-3 text-[15px]" style={{ fontFamily: "'Inter', sans-serif", color: "#7a7264" }}>
            Escribe el nombre y cuántos espacios le reservas. Cada invitado recibe su propio enlace: la
            invitación llega con su nombre en el sobre y con sus espacios.
          </p>
        </header>

        <section
          className="mt-10 rounded-2xl p-5 sm:p-6"
          style={{ background: "#FFFDF7", boxShadow: "0 18px 36px -20px rgba(60,45,15,0.35), 0 0 0 1px rgba(150,105,30,0.14)" }}
        >
          <label
            htmlFor="base"
            className="text-[12px] uppercase tracking-[0.22em]"
            style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, color: "#4a7ba6" }}
          >
            Dirección del sitio
          </label>
          <input
            id="base"
            type="url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://tuusuario.github.io/boda"
            className="mt-2 w-full rounded-lg border bg-transparent px-3 py-2.5 text-base outline-none focus:border-[rgba(150,105,30,0.6)]"
            style={inputStyle}
          />
          <p className="mt-2 text-[13px]" style={{ fontFamily: "'Inter', sans-serif", color: "#9a9184" }}>
            Cuando publiques la invitación, pega aquí su dirección real para que los enlaces apunten ahí.
          </p>
        </section>

        <form
          onSubmit={addGuest}
          className="mt-6 rounded-2xl p-5 sm:p-6"
          style={{ background: "#FFFDF7", boxShadow: "0 18px 36px -20px rgba(60,45,15,0.35), 0 0 0 1px rgba(150,105,30,0.14)" }}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label
                htmlFor="nombre"
                className="text-[12px] uppercase tracking-[0.22em]"
                style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, color: "#4a7ba6" }}
              >
                Nombre del invitado
              </label>
              <input
                id="nombre"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Familia Pérez"
                className="mt-2 w-full rounded-lg border bg-transparent px-3 py-2.5 text-base outline-none focus:border-[rgba(150,105,30,0.6)]"
                style={inputStyle}
              />
            </div>

            <div className="sm:w-36">
              <label
                htmlFor="pases"
                className="text-[12px] uppercase tracking-[0.22em]"
                style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, color: "#4a7ba6" }}
              >
                Espacios
              </label>
              <input
                id="pases"
                type="number"
                min={1}
                max={20}
                value={pases}
                onChange={(e) => setPases(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                className="mt-2 w-full rounded-lg border bg-transparent px-3 py-2.5 text-base outline-none focus:border-[rgba(150,105,30,0.6)]"
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              disabled={!nombre.trim()}
              className="rounded-full px-6 py-3 text-[13px] uppercase tracking-[0.18em] text-white transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45"
              style={{
                background: "linear-gradient(135deg, var(--wax-gold-light), var(--wax-gold-dark))",
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
              }}
            >
              Agregar
            </button>
          </div>
        </form>

        {guests.length > 0 && (
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[15px]" style={{ fontFamily: "'Inter', sans-serif", color: "#6b6156" }}>
              <strong>{guests.length}</strong> {guests.length === 1 ? "invitación" : "invitaciones"} ·{" "}
              <strong>{totalPersonas}</strong> {totalPersonas === 1 ? "espacio" : "espacios"} en total
            </p>
            <button
              type="button"
              onClick={copyAll}
              className="rounded-full border px-4 py-2 text-[13px] transition active:scale-[0.97]"
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 600,
                color: "#6b4d12",
                borderColor: "rgba(150,105,30,0.35)",
              }}
            >
              {copiedId === "all" ? "¡Copiada la lista!" : "Copiar toda la lista"}
            </button>
          </div>
        )}

        <ul className="mt-4 flex flex-col gap-3">
          {guests.map((guest) => {
            const link = buildLink(baseUrl, guest);
            return (
              <li
                key={guest.id}
                className="rounded-2xl p-4 sm:p-5"
                style={{ background: "#FFFDF7", boxShadow: "0 14px 28px -18px rgba(60,45,15,0.3), 0 0 0 1px rgba(150,105,30,0.12)" }}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-2xl" style={{ fontFamily: "'Tangerine', cursive", fontWeight: 700, color: "#2a1f14", fontSize: "2rem" }}>
                    {guest.nombre}
                  </span>
                  <span
                    className="rounded-full px-3 py-1 text-[12px]"
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontWeight: 600,
                      color: "#6b4d12",
                      background: "linear-gradient(160deg, #FEF6E0, #F3DFA0)",
                    }}
                  >
                    {guest.pases === 1 ? "1 espacio" : `${guest.pases} espacios`}
                  </span>
                </div>

                <p
                  className="mt-2 break-all text-[13px]"
                  style={{ fontFamily: "'Inter', sans-serif", color: "#9a9184" }}
                >
                  {link}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => copy(link, guest.id)}
                    className="rounded-full px-4 py-2 text-[13px] text-white transition active:scale-[0.97]"
                    style={{
                      background: "linear-gradient(135deg, var(--wax-gold-light), var(--wax-gold-dark))",
                      fontFamily: "'Inter', sans-serif",
                      fontWeight: 600,
                    }}
                  >
                    {copiedId === guest.id ? "¡Copiado!" : "Copiar enlace"}
                  </button>
                  <a
                    href={whatsappHref(guest)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border px-4 py-2 text-[13px] transition active:scale-[0.97]"
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontWeight: 600,
                      color: "#1f7a4d",
                      borderColor: "rgba(31,122,77,0.35)",
                    }}
                  >
                    Enviar por WhatsApp
                  </a>
                  <a
                    href={link}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border px-4 py-2 text-[13px] transition active:scale-[0.97]"
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontWeight: 600,
                      color: "#4a7ba6",
                      borderColor: "rgba(74,123,166,0.35)",
                    }}
                  >
                    Ver invitación
                  </a>
                  <button
                    type="button"
                    onClick={() => removeGuest(guest.id)}
                    className="ml-auto rounded-full px-3 py-2 text-[13px] transition active:scale-[0.97]"
                    style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, color: "#c0564f" }}
                  >
                    Quitar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>

        {loaded && guests.length === 0 && (
          <p
            className="mt-10 text-center text-[15px]"
            style={{ fontFamily: "'Inter', sans-serif", color: "#9a9184" }}
          >
            Todavía no hay invitados en la lista. Agrega el primero arriba.
          </p>
        )}

        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Tangerine:wght@400;700&family=Inter:wght@400;500;600&display=swap"
        />
      </div>
    </main>
  );
}
