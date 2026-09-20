import { createFileRoute } from "@tanstack/react-router";
import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type MouseEvent,
} from "react";
import waxSeal from "@/assets/wax-seal.png";
import butterflyReal from "@/assets/butterfly-real.png";
import roseBokehBg from "@/assets/wedding-photo-bg.jpg";
import photoKiss from "@/assets/couple-kiss.jpg";
import photoHands from "@/assets/couple-hands.jpg";
import photoLaugh from "@/assets/couple-laugh.jpg";
import photoRingCheek from "@/assets/couple-ring-cheek.jpg";
import photoRing from "@/assets/couple-ring.jpg";
import photoNewspaperRing from "@/assets/couple-newspaper-ring.jpg";
import photoNewspapers from "@/assets/couple-newspapers.jpg";
import photoExtra from "@/assets/couple-extra.jpg";

// Every photo in this shoot is 4:3 landscape — frames that hold them are sized
// to match, so a wide two-person shot never gets cropped down to one person.
const GALLERY_IMAGES = [
  photoKiss,
  photoHands,
  photoRingCheek,
  photoLaugh,
  photoNewspapers,
  photoExtra,
  photoNewspaperRing,
];

// The song that starts the moment the wax seal is tapped. Drop the file at
// src/assets/night-changes.mp3 (see docs/musica.md) — until it exists the
// player stays silent and the rest of the invitation is unaffected.
const SONG_URL = "/night-changes.mp3";

// The RSVP form posts straight to this Google Form's response endpoint, which
// lands each submission as a row in its linked Google Sheet — free, no backend
// needed for a static GitHub Pages site, and no Apps Script auth screen either.
// See docs/rsvp-google-sheets-setup.md for how the entry IDs below were found.
const GOOGLE_FORM_ACTION_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLScnGc51Ue42DYhAL5VkhOdmBNMYR-wjYZylq6YZyHxsk7HAzA/formResponse";
const GOOGLE_FORM_ENTRY_NOMBRE = "entry.721620457";
const GOOGLE_FORM_ENTRY_ASISTENCIA = "entry.2110773338";

// How long the wipe takes to grow from the tapped card and fully cover the
// screen. The scroll jump happens the instant it's fully covered, so the jump
// itself is never visible — only the wipe growing, then clearing, is.
const WIPE_COVER_MS = 480;
const WIPE_REVEAL_MS = 420;

export const Route = createFileRoute("/")({
  component: Index,
  // Reads ?invitado=Nombre from the URL so each guest can get their own link
  // (e.g. tusitio.com/?invitado=Maria+Lopez) with the invitation and RSVP
  // already addressed to them, instead of a generic placeholder.
  validateSearch: (search: Record<string, unknown>): { invitado?: string } => ({
    invitado: typeof search.invitado === "string" && search.invitado.trim() ? search.invitado.trim() : undefined,
  }),
});

// Three bars that dance while the song plays and settle flat when it's muted —
// the state is legible at a glance without a label.
function MusicIcon({ playing }: { playing: boolean }) {
  const bars = [
    { x: 4, delay: "0s", tall: 13 },
    { x: 10.5, delay: "0.18s", tall: 18 },
    { x: 17, delay: "0.36s", tall: 10 },
  ];
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      {bars.map((b) => (
        <rect
          key={b.x}
          className={playing ? "music-bar" : undefined}
          x={b.x}
          y={playing ? 22 - b.tall : 15}
          width="3"
          height={playing ? b.tall : 4}
          rx="1.5"
          fill="var(--wax-gold-dark)"
          style={{ animationDelay: b.delay, transformOrigin: "center bottom" }}
        />
      ))}
    </svg>
  );
}

function Index() {
  const [open, setOpen] = useState(false);
  const [galleryRevealed, setGalleryRevealed] = useState(false);
  const { invitado } = Route.useSearch();
  const guestName = invitado ?? "Invitado";
  const galleryRef = useRef<HTMLElement>(null);

  const audioRef = useRef<HTMLAudioElement>(null);
  const [musicOn, setMusicOn] = useState(false);
  const [musicAvailable, setMusicAvailable] = useState(true);

  // Tapping the seal is the user gesture browsers require before audio may
  // start, so the song is kicked off from inside that handler rather than an
  // effect — an effect would fire without a gesture and be blocked.
  const openEnvelope = () => {
    setOpen(true);
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0;
    audio
      .play()
      .then(() => {
        setMusicOn(true);
        // Ease in rather than cutting in at full volume over the flap opening.
        const target = 0.55;
        const step = target / 40;
        const fade = window.setInterval(() => {
          if (!audioRef.current || audioRef.current.volume >= target - step) {
            if (audioRef.current) audioRef.current.volume = target;
            window.clearInterval(fade);
            return;
          }
          audioRef.current.volume = Math.min(target, audioRef.current.volume + step);
        }, 60);
      })
      .catch(() => {
        // No file dropped in yet, or the browser refused: stay silent and keep
        // the control hidden instead of showing a button that does nothing.
        setMusicAvailable(false);
      });
  };

  const toggleMusic = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().then(() => setMusicOn(true)).catch(() => setMusicAvailable(false));
    } else {
      audio.pause();
      setMusicOn(false);
    }
  };

  // "idle" — nothing on screen. "entering" — the wipe is mounted at its tiny
  // starting size, one frame before the transition kicks in (so the browser
  // has something to animate *from*). "covering" — it's growing to fill the
  // screen from the tapped card. "leaving" — it's fading away to reveal the
  // gallery, already scrolled into place underneath it.
  const [wipe, setWipe] = useState<"idle" | "entering" | "covering" | "leaving">("idle");
  const [wipeOrigin, setWipeOrigin] = useState({ x: "50%", y: "50%" });

  const goToGallery = (e: MouseEvent<HTMLButtonElement>) => {
    if (wipe !== "idle") return; // ignore repeat taps mid-transition

    const jumpToGallery = () => {
      // Fire the section's reveal right as the wipe finishes covering the
      // screen, so by the time it clears, the content is already animating
      // in — arriving there is the payoff, not the start.
      setGalleryRevealed(true);
      galleryRef.current?.scrollIntoView({ block: "start" });
    };

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      jumpToGallery();
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    setWipeOrigin({
      x: `${((rect.left + rect.width / 2) / window.innerWidth) * 100}%`,
      y: `${((rect.top + rect.height / 2) / window.innerHeight) * 100}%`,
    });

    setWipe("entering");
    requestAnimationFrame(() => requestAnimationFrame(() => setWipe("covering")));

    window.setTimeout(() => {
      jumpToGallery();
      setWipe("leaving");
      window.setTimeout(() => setWipe("idle"), WIPE_REVEAL_MS);
    }, WIPE_COVER_MS);
  };

  return (
    <main className="relative overflow-x-hidden" style={{ background: "#FFF9EF" }}>
      <audio ref={audioRef} src={SONG_URL} loop preload="auto" />

      {/* Music control — a translucent material that only appears once the
          envelope is open and the song is actually playable. */}
      {open && musicAvailable && (
        <button
          type="button"
          onClick={toggleMusic}
          aria-label={musicOn ? "Silenciar música" : "Reproducir música"}
          className="music-toggle fixed bottom-5 right-5 z-[150] flex h-12 w-12 items-center justify-center rounded-full"
          style={{
            background: "rgba(255, 249, 239, 0.72)",
            backdropFilter: "blur(20px) saturate(180%)",
            WebkitBackdropFilter: "blur(20px) saturate(180%)",
            border: "1px solid rgba(255,255,255,0.6)",
            boxShadow: "0 8px 24px -8px rgba(90,60,20,0.45)",
          }}
        >
          <MusicIcon playing={musicOn} />
        </button>
      )}

      {wipe !== "idle" && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[200]"
          style={{
            background: "radial-gradient(circle at center, #FFFBF0 0%, #FAE9C2 55%, #E8C447 100%)",
            transformOrigin: `${wipeOrigin.x} ${wipeOrigin.y}`,
            transform: wipe === "entering" ? "scale(0.02)" : "scale(1)",
            opacity: wipe === "covering" ? 1 : 0,
            transition:
              wipe === "entering"
                ? "none"
                : wipe === "covering"
                  ? `transform ${WIPE_COVER_MS}ms cubic-bezier(0.23,1,0.32,1), opacity 260ms ease-out`
                  : `opacity ${WIPE_REVEAL_MS}ms ease-out`,
          }}
        />
      )}

      <section className="relative flex min-h-screen flex-col items-center justify-center px-4 py-16">
      <Butterflies />

      {/* Love phrase — sits well clear of the envelope so the rising flap never crosses it */}
      <p
        className="love-phrase relative m-0 px-4 text-center text-3xl italic leading-snug sm:text-4xl"
        style={{
          color: "#78ADD4",
          fontFamily: "'Tangerine', cursive",
          letterSpacing: "0.02em",
          maxWidth: "26rem",
        }}
      >
        “Dos historias que decidieron convertirse en una sola”
      </p>

      {/* Envelope stage — wide landscape like a real invitation envelope.
          marginTop scales with the stage's own width. Closed, it only needs a
          normal gap under the phrase; open, it needs the wider gap (same ratio
          as the flap's rise) so the risen flap can never reach up into the
          phrase above it. The two are swapped with a matching delay so the
          gap only shrinks again once the flap has fully folded back down —
          never while it's still up mid-close. */}
      <div
        className="relative"
        style={{
          width: "min(92vw, 620px)",
          aspectRatio: "1.55 / 1",
          perspective: "2000px",
          marginTop: open ? "calc(0.45 * min(92vw, 620px))" : "calc(0.15 * min(92vw, 620px))",
          transition: `margin-top 900ms ease ${open ? "0s" : "1100ms"}`,
        }}
      >
        {/* ============ CARDS (rise up out of the envelope) ============ */}
        <div
          className="absolute inset-x-0 flex items-end justify-center"
          style={{
            bottom: "42%", // sits just above the pocket rim when open
            height: "110%",
            zIndex: 4,
            pointerEvents: open ? "auto" : "none",
          }}
        >
          <div className="relative flex h-full w-[92%] items-end justify-center gap-3 sm:gap-4">
            {[
              { kind: "guest",   delay: 0.7,  rotate: "-8deg", tx: "-102%", ty: "-9%",  z: 2 },
              { kind: "photo",   delay: 0.45, rotate: "0deg",  tx: "0%",    ty: "-19%", z: 3 },
              { kind: "details", delay: 0.9,  rotate: "8deg",  tx: "102%",  ty: "-9%",  z: 2 },
            ].map((c) => (
              <div
                key={c.kind}
                className="absolute bottom-0 flex aspect-[3/4] w-[34%] max-w-[205px] flex-col overflow-hidden rounded-lg"
                style={{
                  background: "linear-gradient(180deg, #fbf6ea 0%, #eadfc4 100%)",
                  boxShadow:
                    "0 22px 40px -12px rgba(0,0,0,0.6), 0 2px 6px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,0,0,0.15)",
                  transform: open
                    ? `translate(${c.tx}, ${c.ty}) rotate(${c.rotate})`
                    : "translate(0%, 55%) rotate(0deg) scale(0.92)",
                  opacity: open ? 1 : 0,
                  transition: `transform 1100ms cubic-bezier(.2,.9,.25,1.1) ${c.delay}s, opacity 500ms ease ${c.delay}s`,
                  zIndex: c.z,
                }}
              >
                {c.kind === "photo" && (
                  <img
                    src={photoKiss}
                    alt="Julio y Diana"
                    width={1280}
                    height={960}
                    // The shoot is 4:3 landscape and this card is 3:4 portrait,
                    // so the crop is pushed toward the two faces instead of the
                    // geometric centre, which would clip her out of frame.
                    className="h-full w-full object-cover"
                    style={{ objectPosition: "62% 42%" }}
                  />
                )}
                {c.kind === "guest" && (
                  <div className="flex h-full flex-col items-center justify-center px-3 text-center">
                    <span className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--wax-gold-dark)" }}>
                      Para
                    </span>
                    <span
                      className="mt-1.5 text-[26px] leading-tight sm:text-4xl"
                      style={{ fontFamily: "'Tangerine', cursive", fontWeight: 700, color: "#2a1f14" }}
                    >
                      {`{${guestName}}`}
                    </span>
                    <div className="mt-2 h-px w-8" style={{ background: "var(--wax-gold)" }} />
                    <span className="mt-3 text-[11px] uppercase tracking-[0.22em] text-neutral-500">Con cariño</span>
                  </div>
                )}
                {c.kind === "details" && (
                  <div className="flex h-full flex-col items-center justify-between px-2.5 py-3.5 text-center">
                    <span className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--wax-gold-dark)" }}>
                      Detalles
                    </span>
                    <p
                      className="text-[26px] leading-[1.15] sm:text-3xl"
                      style={{ fontFamily: "'Tangerine', cursive", color: "#2a1f14" }}
                    >
                      Ver
                      <br />
                      más
                    </p>
                    <button
                      type="button"
                      onClick={goToGallery}
                      className="rounded-full px-3.5 py-1.5 text-[11px] uppercase tracking-[0.22em] text-white transition duration-200 ease-out hover:scale-105 hover:shadow-lg active:scale-95"
                      style={{ background: "linear-gradient(135deg, var(--wax-gold-light), var(--wax-gold-dark))" }}
                    >
                      Abrir
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ============ ENVELOPE BODY ============ */}
        {/* Back panel — the inside back you see once the flap opens */}
        <div
          className="absolute inset-0 overflow-hidden rounded-[3px]"
          style={{
            background: "linear-gradient(160deg, #FDF3DD 0%, #FAE9C2 45%, #E6C989 100%)",
            boxShadow:
              "0 30px 50px -20px rgba(120,90,30,0.35), 0 0 0 1px rgba(120,90,30,0.3)",
          }}
        >
          {/* Paper linen texture */}
          <EnvelopeTexture />
        </div>

        {/* Front pocket — the part that hides the lower half of the cards */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden rounded-b-[3px]"
          style={{
            height: "58%",
            zIndex: 8,
            background:
              "linear-gradient(180deg, #F6E4BC 0%, #FAE9C2 45%, #E6C989 100%)",
            clipPath: "polygon(0 0, 50% 42%, 100% 0, 100% 100%, 0 100%)",
            boxShadow:
              "inset 0 5px 12px rgba(120,90,30,0.25), inset 0 -16px 30px rgba(120,90,30,0.15)",
          }}
        >
          {/* Side flap seams (V lines from bottom corners meeting at top center) */}
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 600 240" preserveAspectRatio="none">
            <line x1="0" y1="240" x2="300" y2="100" stroke="rgba(150,105,30,0.7)" strokeWidth="1.5" />
            <line x1="600" y1="240" x2="300" y2="100" stroke="rgba(150,105,30,0.7)" strokeWidth="1.5" />
            <line x1="0" y1="240" x2="300" y2="100" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" transform="translate(0,-1)" />
            <line x1="600" y1="240" x2="300" y2="100" stroke="rgba(255,255,255,0.35)" strokeWidth="0.5" transform="translate(0,-1)" />
          </svg>
          {/* Top rim highlight (paper edge where flap tucks in) */}
          <div
            className="absolute inset-x-0 top-0"
            style={{
              height: "6px",
              clipPath: "polygon(0 0, 50% 100%, 100% 0, 100% 40%, 50% 100%, 0 40%)",
              background: "linear-gradient(to bottom, rgba(255,255,255,0.22), transparent)",
            }}
          />
          <EnvelopeTexture />
        </div>

        {/* ============ TOP FLAP (opens up) ============ */}
        <div
          className="absolute inset-x-0 top-0"
          style={{
            height: "58%",
            zIndex: open ? 1 : 12,
            transformStyle: "preserve-3d",
            transformOrigin: "top center",
            transform: open ? "rotateX(-180deg)" : "rotateX(0deg)",
            transition: `transform 1100ms cubic-bezier(.55,.05,.35,1), z-index 0s ${open ? "0s" : "1100ms"}`,
          }}
        >
          {/* Single flap face — a full 180deg fold around the hinge lands it
              flat again, pointing up and flush against the envelope back,
              instead of stopping mid-air at some in-between 3D angle. */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, #FCEEB0 0%, #FAE186 55%, #E8C447 100%)",
              clipPath: "polygon(0 0, 100% 0, 50% 100%)",
              boxShadow: "inset 0 -14px 24px rgba(168,114,30,0.22)",
              filter: "drop-shadow(0 10px 14px rgba(150,105,30,0.35))",
            }}
          >
            <EnvelopeTexture clip="polygon(0 0, 100% 0, 50% 100%)" />
            {/* crisp fold seams along both slanted edges, like the pocket's */}
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 600 240" preserveAspectRatio="none">
              <line x1="0" y1="0" x2="300" y2="240" stroke="rgba(150,105,30,0.7)" strokeWidth="1.5" />
              <line x1="600" y1="0" x2="300" y2="240" stroke="rgba(150,105,30,0.7)" strokeWidth="1.5" />
            </svg>
            {/* soft crease down the middle */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(to right, transparent 49.6%, rgba(150,105,30,0.3) 50%, transparent 50.4%)",
                clipPath: "polygon(0 0, 100% 0, 50% 100%)",
              }}
            />
            {/* highlight along the top edge */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0"
              style={{ height: "2px", background: "rgba(255,255,255,0.5)" }}
            />
          </div>

          {/* Wax seal — anchored to the flap's tip, moves with it */}
          <button
            type="button"
            onClick={openEnvelope}
            aria-label={open ? "Cerrar sobre" : "Abrir sobre"}
            // The seal is the one gesture the whole page hangs on, so it
            // answers the finger on press rather than waiting for release.
            className="wax-seal group absolute left-1/2 -translate-x-1/2 focus:outline-none"
            style={{
              bottom: "-14%",
              zIndex: 20,
              pointerEvents: open ? "none" : "auto",
              opacity: open ? 0 : 1,
              transition: "opacity 350ms ease 150ms",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
            }}
          >
            <img
              src={waxSeal}
              alt="Sello de cera J&D"
              width={1024}
              height={1024}
              className="h-20 w-20 select-none sm:h-24 sm:w-24"
              style={{
                filter:
                  "drop-shadow(0 10px 18px rgba(0,0,0,0.6)) drop-shadow(0 2px 4px rgba(0,0,0,0.5))",
              }}
              draggable={false}
            />
          </button>
        </div>

        {/* Hint text */}
        <div
          className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[12px] uppercase tracking-[0.34em] text-black/50"
          style={{
            bottom: "-2.5rem",
            opacity: open ? 0 : 1,
            transition: "opacity 300ms ease",
          }}
        >
          Toca el sello para abrir
        </div>

        {/* Reset button when open */}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="absolute left-1/2 -translate-x-1/2 rounded-full border border-black/20 px-4 py-1.5 text-[12px] uppercase tracking-[0.26em] text-black/60 backdrop-blur transition hover:bg-black/5"
          style={{
            bottom: "-3rem",
            opacity: open ? 1 : 0,
            pointerEvents: open ? "auto" : "none",
            transition: "opacity 400ms ease 900ms",
          }}
        >
          Cerrar sobre
        </button>
      </div>
      </section>

      <WeddingGallerySection ref={galleryRef} revealed={galleryRevealed} />

      <OurStoryTimeline />

      <CountdownSection />

      <CeremonySection />

      <DressCodeSection />

      <GiftSection />

      <RsvpSection guestName={invitado} />

      {/* Google font for script lettering */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500&family=Great+Vibes&family=Tangerine:wght@400;700&family=Inter:wght@400;500;600&display=swap"
      />
    </main>
  );
}

function EnvelopeTexture({ clip }: { clip?: string }) {
  return (
    <>
      {/* linen weave */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.28]"
        style={{
          clipPath: clip,
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(255,255,255,0.1) 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, rgba(150,105,30,0.16) 0 1px, transparent 1px 3px)",
        }}
      />
      {/* fine fractal grain */}
      <div
        className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-35"
        style={{
          clipPath: clip,
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.6 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
          backgroundSize: "260px 260px",
        }}
      />
      {/* vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          clipPath: clip,
          background:
            "radial-gradient(ellipse at 50% 50%, transparent 60%, rgba(150,105,30,0.3) 100%)",
        }}
      />
    </>
  );
}

// Hue-rotated from the source photo's natural blue (~205deg) to a vivid gold-yellow
// (~48deg); values picked by sampling the real photo's pixels so the tonal range
// (pale highlight to deep shadow) still comes from genuine photographic shading.
const BUTTERFLY_YELLOW_FILTER = "hue-rotate(203deg) saturate(1.8) brightness(1.3)";

const BUTTERFLIES = [
  { top: "14%", left: "8%",  size: 78, path: "butterfly-path-a", duration: "13s", delay: "-1s",  flip: false, opacity: 0.95, blur: 0 },
  { top: "24%", left: "80%", size: 52, path: "butterfly-path-b", duration: "16s", delay: "-6s",  flip: true,  opacity: 0.85, blur: 0.5 },
  { top: "58%", left: "87%", size: 40, path: "butterfly-path-a", duration: "11s", delay: "-3s",  flip: true,  opacity: 0.7,  blur: 1 },
  { top: "8%",  left: "45%", size: 34, path: "butterfly-path-b", duration: "14s", delay: "-9s",  flip: false, opacity: 0.75, blur: 0.5 },
  { top: "62%", left: "6%",  size: 46, path: "butterfly-path-b", duration: "12s", delay: "-4.5s", flip: false, opacity: 0.9,  blur: 0 },
  { top: "5%",  left: "78%", size: 30, path: "butterfly-path-a", duration: "15s", delay: "-11s", flip: true,  opacity: 0.65, blur: 1 },
];

function Butterflies() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {BUTTERFLIES.map((b, i) => (
        <div
          key={i}
          className={`absolute ${b.path}`}
          style={{
            top: b.top,
            left: b.left,
            animationDuration: b.duration,
            animationDelay: b.delay,
          }}
        >
          <div
            className="butterfly-flap"
            style={{ animationDelay: `${i * 0.15}s` }}
          >
            <img
              src={butterflyReal}
              alt=""
              width={220}
              height={179}
              style={{
                width: b.size,
                height: "auto",
                transform: b.flip ? "scaleX(-1)" : undefined,
                opacity: b.opacity,
                filter: `${BUTTERFLY_YELLOW_FILTER} drop-shadow(0 8px 10px rgba(120,90,10,0.35))${b.blur ? ` blur(${b.blur}px)` : ""}`,
              }}
              draggable={false}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Heart({ size = 16, color = "#E8C447" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 29" fill="none" aria-hidden="true">
      <path
        d="M16 28 C16 28 2 19 2 9.5 C2 4.5 5.8 1 10 1 C13 1 15 3 16 5 C17 3 19 1 22 1 C26.2 1 30 4.5 30 9.5 C30 19 16 28 16 28 Z"
        fill={color}
      />
    </svg>
  );
}

// Fixed per-photo rotation for the resting pile, so it reads as a hand-tossed
// stack of same-size prints rather than a procedural pattern.
const STACK_TILTS = [-6, 4.5, -3.5, 6.5, -4.5, 3];

// A physical stack of same-size photos: only the front one sits square and
// fully visible, the rest peek out at a rotated edge behind it. Every few
// seconds the front photo drops away out of the pile and the next one takes
// its place, recycling to the back once it's gone — like flipping through a
// real stack of prints instead of a flat, scrolling filmstrip.
const STACK_LEAVE_MS = 560;
const STACK_HOLD_MS = 3400;

function PhotoStack({ images, paused }: { images: string[]; paused: boolean }) {
  const n = images.length;
  const [frontIndex, setFrontIndex] = useState(0);
  const [leaving, setLeaving] = useState<number | null>(null);
  // The photo that just fell away is teleported to the back of the pile while
  // it is still invisible. Without suppressing its transition for that one
  // frame it visibly flies back up through the stack from below — the bug that
  // made this section look broken.
  const [snapping, setSnapping] = useState<number | null>(null);

  const frontRef = useRef(frontIndex);
  frontRef.current = frontIndex;

  useEffect(() => {
    if (paused || n < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let leaveTimer = 0;
    let settleFrame = 0;
    const cycle = window.setInterval(() => {
      const departing = frontRef.current;
      setLeaving(departing);
      leaveTimer = window.setTimeout(() => {
        setSnapping(departing);
        setLeaving(null);
        setFrontIndex((f) => (f + 1) % n);
        // Two frames: one to paint it at the back with no transition, the next
        // to hand control back so it can fade in place.
        settleFrame = requestAnimationFrame(() =>
          requestAnimationFrame(() => setSnapping(null)),
        );
      }, STACK_LEAVE_MS);
    }, STACK_HOLD_MS);

    return () => {
      window.clearInterval(cycle);
      window.clearTimeout(leaveTimer);
      cancelAnimationFrame(settleFrame);
    };
  }, [paused, n]);

  return (
    <div className="relative w-full" style={{ aspectRatio: "4 / 3" }}>
      {images.map((src, i) => {
        const depth = (i - frontIndex + n) % n;
        const isLeaving = leaving === i;
        const isSnapping = snapping === i;
        const tilt = STACK_TILTS[i % STACK_TILTS.length];
        // Only the first few layers fan out; past that they sit in place, the
        // way a real pile stops showing depth once it's a few prints thick.
        const layer = Math.min(depth, 3);
        const drift = layer * (i % 2 === 0 ? 6 : -6);

        return (
          <img
            key={i}
            src={src}
            alt=""
            className="absolute inset-0 h-full w-full rounded-[22px] object-cover"
            style={{
              boxShadow:
                "0 26px 50px -20px rgba(60,45,15,0.55), 0 0 0 7px #FFFCF3, 0 0 0 8px rgba(150,105,30,0.22)",
              zIndex: isLeaving ? n + 1 : n - depth,
              opacity: isLeaving || isSnapping ? 0 : 1,
              // Depth reads through shading rather than scale, so every print
              // in the pile stays exactly the same size.
              filter: depth === 0 ? "none" : `brightness(${1 - Math.min(depth, 3) * 0.06})`,
              transform: isLeaving
                ? "translate(-14%, 118%) rotate(-19deg)"
                : `translate(${drift}px, ${layer * 8}px) rotate(${depth === 0 ? 0 : tilt}deg)`,
              transition: isSnapping
                ? "none"
                : isLeaving
                  ? // Falls away with gravity's acceleration, fading only near the end
                    `transform ${STACK_LEAVE_MS}ms cubic-bezier(0.32,0,0.67,0), opacity ${STACK_LEAVE_MS - 180}ms ease-in 180ms`
                  : "transform 520ms cubic-bezier(0.22,1,0.36,1), opacity 420ms ease-out, filter 520ms ease-out",
            }}
            draggable={false}
          />
        );
      })}
    </div>
  );
}

const WeddingGallerySection = forwardRef<HTMLElement, { revealed?: boolean }>(function WeddingGallerySection(
  { revealed },
  ref,
) {
  const [observedInView, setObservedInView] = useState(false);
  const [paused, setPaused] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const inView = revealed || observedInView;

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setObservedInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={(node) => {
        sectionRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      className="relative flex flex-col items-center overflow-hidden px-4 py-14 sm:py-20"
    >
      {/* soft rose-bokeh backdrop, real photo, gently blurred */}
      <img
        src={roseBokehBg}
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        style={{ filter: "blur(3px)", transform: "scale(1.08)" }}
        draggable={false}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,249,239,0.4) 0%, rgba(255,249,239,0.55) 55%, rgba(255,249,239,0.4) 100%)",
        }}
      />

      <div className="relative flex w-full flex-col items-center">
        <h2
          style={{
            fontFamily: "'Tangerine', cursive",
            fontWeight: 500,
            color: "var(--wax-gold-dark)",
            letterSpacing: "0.02em",
            opacity: inView ? 1 : 0,
            transform: inView ? "translateY(0) scale(1)" : "translateY(16px) scale(0.97)",
            transition: "opacity 500ms ease-out, transform 500ms cubic-bezier(.34,1.56,.64,1)",
          }}
          className="text-7xl sm:text-8xl"
        >
          Nuestra Boda
        </h2>
        <p
          className="mt-1 text-xs uppercase tracking-[0.35em] sm:text-sm"
          style={{
            fontFamily: "'Inter', sans-serif",
            color: "#a08a5f",
            opacity: inView ? 1 : 0,
            transition: "opacity 500ms ease-out 150ms",
          }}
        >
          Toca la galería para detenerla
        </p>

        {/* A physical pile of same-size prints, not a scrolling strip: only the
            front photo sits square, the rest peek out rotated behind it, and
            every few seconds the front one drops away to reveal the next.
            Pausing happens on pointer-down — the instant of the touch, not on
            release — so holding to look at a photo feels immediate. */}
        <div
          className="relative mx-auto mt-12 w-full max-w-[min(76vw,440px)] cursor-pointer select-none"
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? "translateY(0) scale(1)" : "translateY(24px) scale(0.96)",
            transition:
              "opacity 700ms ease-out 120ms, transform 800ms cubic-bezier(0.22,1,0.36,1) 120ms",
          }}
          onPointerEnter={() => setPaused(true)}
          onPointerLeave={() => setPaused(false)}
          onPointerDown={() => setPaused(true)}
          onClick={() => setPaused((p) => !p)}
        >
          <PhotoStack images={GALLERY_IMAGES} paused={!inView || paused} />
        </div>

        {/* date, with small hearts breaking up the day / month / year */}
        <div
          className="mt-14 flex items-center gap-4"
          style={{
            opacity: inView ? 1 : 0,
            transform: inView ? "translateY(0)" : "translateY(10px)",
            transition: "opacity 500ms ease-out 380ms, transform 500ms cubic-bezier(.34,1.56,.64,1) 380ms",
          }}
        >
          <span className="text-5xl sm:text-6xl" style={{ fontFamily: "'Tangerine', cursive", fontWeight: 700, color: "#2a1f14" }}>
            13
          </span>
          <Heart size={20} />
          <span className="text-5xl sm:text-6xl" style={{ fontFamily: "'Tangerine', cursive", fontWeight: 700, color: "#2a1f14" }}>
            Diciembre
          </span>
          <Heart size={20} />
          <span className="text-5xl sm:text-6xl" style={{ fontFamily: "'Tangerine', cursive", fontWeight: 700, color: "#2a1f14" }}>
            2026
          </span>
        </div>
      </div>
    </section>
  );
});

function StoryIcon({
  kind,
  size = 20,
  color = "#8a6a2a",
}: {
  kind: "spark" | "heart" | "infinity" | "ring" | "rings";
  size?: number;
  color?: string;
}) {
  switch (kind) {
    case "spark":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2L14.2 9.8L22 12L14.2 14.2L12 22L9.8 14.2L2 12L9.8 9.8Z" fill={color} />
        </svg>
      );
    case "heart":
      return (
        <svg width={size} height={size} viewBox="0 0 24 22" fill="none" aria-hidden="true">
          <path
            d="M12 21S2 14.5 2 7.8C2 4.6 4.5 2 7.6 2C9.6 2 11.2 3 12 4.6C12.8 3 14.4 2 16.4 2C19.5 2 22 4.6 22 7.8C22 14.5 12 21 12 21Z"
            fill={color}
          />
        </svg>
      );
    case "infinity":
      return (
        <svg width={size} height={size * 0.6} viewBox="0 0 36 22" fill="none" aria-hidden="true">
          <path
            d="M9 4C4 4 2 8 2 11C2 14 4 18 9 18C15 18 15 4 27 4C32 4 34 8 34 11C34 14 32 18 27 18C21 18 21 4 9 4Z"
            stroke={color}
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
      );
    case "ring":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="15" r="6.3" stroke={color} strokeWidth="1.8" />
          <path d="M12 8.7 8.9 2h6.2L12 8.7Z" fill={color} />
        </svg>
      );
    case "rings":
      return (
        <svg width={size} height={size * 0.72} viewBox="0 0 30 20" fill="none" aria-hidden="true">
          <circle cx="11" cy="10" r="7" stroke={color} strokeWidth="1.8" />
          <circle cx="19" cy="10" r="7" stroke={color} strokeWidth="1.8" />
        </svg>
      );
  }
}

type StoryChapter = {
  icon: "spark" | "heart" | "infinity" | "ring" | "rings";
  date: string;
  title: string;
  paragraphs: string[];
  photo?: string;
};

const STORY: StoryChapter[] = [
  {
    icon: "spark",
    date: "12 de abril, 2015",
    title: "Un encuentro",
    paragraphs: [
      "En un día de campamento como cualquier otro, ninguno de los dos imaginaba que aquella fecha terminaría convirtiéndose en el inicio de una historia que, hasta el día de hoy, seguimos escribiendo juntos.",
      "Fue allí donde Dianita y Julito se conocieron. En aquel momento, solo fueron un saludo, unas palabras y aquel extraño apretón de manos que terminó pareciendo un medio abrazo, sin que ninguno pudiera imaginar que ese pequeño instante estaba destinado a entrelazar nuestros caminos.",
    ],
    photo: photoHands,
  },
  {
    icon: "heart",
    date: "20 de agosto",
    title: "El primer sí",
    paragraphs: [
      "Pasaron los días, los meses y, dos años después, llegó otro 20 de agosto. Esta vez ya no era simplemente un saludo entre dos personas que se acababan de conocer. Era un “sí” que daba comienzo a una relación de niños, a un amor adolescente que quizá muchos pensaron que sería pasajero, que con el tiempo se desvanecería como tantas historias de juventud.",
      "Pero Dios tenía otros planes.",
    ],
    photo: photoLaugh,
  },
  {
    icon: "infinity",
    date: "Ocho años después",
    title: "Creciendo juntos",
    paragraphs: [
      "Aquel nudo que comenzó a formarse entre nosotros fue sostenido por Sus manos. Y lo que parecía ser solamente una historia de adolescentes fue creciendo, madurando y superando cada etapa, cada alegría, cada dificultad, cada lágrima y cada sueño compartido.",
      "Y así pasaron 8 años…",
    ],
    photo: photoKiss,
  },
  {
    icon: "ring",
    date: "La propuesta",
    title: "¿Quieres casarte conmigo?",
    paragraphs: [
      "Hasta que aquel “sí, acepto” volvió a resonar, pero esta vez con un significado todavía más profundo. Ya no era el sí de dos niños que comenzaban una relación, sino el de dos personas que habían decidido caminar juntas hacia el futuro.",
      "Entonces llegó aquella pregunta que durante tanto tiempo estuvo anudada en la garganta. Y nuevamente dijimos que sí.",
    ],
    photo: photoRing,
  },
  {
    icon: "rings",
    date: "13 de diciembre, 2026",
    title: "Para siempre",
    paragraphs: [
      "Ahora, aquellos dos niños que se conocieron aquel 12 de abril de 2015 están a punto de escribir uno de los capítulos más importantes de su historia.",
      "Dianita y Julito estarán frente a Dios, a sus familias y a las personas que aman, pronunciando un nuevo “sí, acepto”. Pero esta vez será para siempre. Será el día en que decidiremos convertirnos en una sola carne, entregarnos el uno al otro y prometernos caminar juntos en cada etapa de la vida: en las alegrías y en las tristezas, en la salud y en la enfermedad, en la prosperidad y en la adversidad.",
      "Prometemos amarnos, cuidarnos, respetarnos, apoyarnos y elegirnos cada día, aun cuando la vida no sea fácil.",
    ],
    photo: photoNewspaperRing,
  },
];

// The letter's closing reflection — read after the traced path ends, as
// full-width prose rather than another marker on the timeline, the way a
// closing page of a letter reads differently from its chapters.
const STORY_CLOSING = [
  "Porque nuestra historia no comenzó con una propuesta de matrimonio. Ni siquiera comenzó con aquel “sí” del 20 de agosto.",
  "Nuestra historia comenzó mucho antes, con un simple encuentro en un campamento, con un saludo, con un apretón de manos que quizá ninguno de los dos entendió en aquel momento… Pero que Dios ya conocía perfectamente.",
  "Y después de 11 años desde aquel primer encuentro, y de 9 años desde aquel primer “sí”, estamos aquí, frente a un nuevo comienzo. Una nueva historia. Un nuevo capítulo. Un mismo camino.",
  "Y si aquella vez éramos solamente dos niños que no sabían lo que el futuro les tenía preparado, hoy somos dos personas que, mirando todo lo que hemos vivido, podemos decir con certeza: Dios estuvo escribiendo nuestra historia desde el principio.",
  "Y ahora, el 13 de diciembre de 2026, comenzaremos juntos el capítulo que dice: “Y fueron una sola carne, y caminaron juntos todos los días de su vida, hasta que la muerte los separe.”",
];

function TimelineRow({
  item,
  index,
  markerRef,
  onRevealed,
}: {
  item: (typeof STORY)[number];
  index: number;
  markerRef: (el: HTMLDivElement | null) => void;
  onRevealed: (i: number) => void;
}) {
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isRight = index % 2 === 1;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          onRevealed(index);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [index, onRevealed]);

  const node = (
    <div
      ref={markerRef}
      className="z-10 h-4 w-4 shrink-0 rounded-full sm:h-[18px] sm:w-[18px]"
      style={{
        background: inView ? "linear-gradient(135deg, #FEF6E0, #E8C447)" : "#FFF9EF",
        boxShadow: inView
          ? "0 0 0 4px #FFF9EF, 0 0 0 5px rgba(150,105,30,0.4), 0 4px 10px -2px rgba(150,105,30,0.5)"
          : "0 0 0 4px #FFF9EF, 0 0 0 5px rgba(150,105,30,0.22)",
        transform: inView ? "scale(1)" : "scale(0.5)",
        transition: "transform 450ms cubic-bezier(.34,1.56,.64,1), background 450ms ease, box-shadow 450ms ease",
      }}
    />
  );

  // Slides in from its own side with a slight rotation that settles flat —
  // reads like a page being set down into place, not just a fade-up card.
  const card = (
    <div
      className="relative w-full overflow-hidden rounded-2xl px-6 py-6 sm:px-7 sm:py-7"
      style={{
        // Has to leave room for the marker, the gaps and the section padding,
        // or the card runs off the side of a phone screen.
        maxWidth: "min(24rem, calc(100vw - 6rem))",
        background: "linear-gradient(160deg, #FFFCF3 0%, #FBEFCF 100%)",
        boxShadow: "0 20px 40px -18px rgba(60,45,15,0.35), 0 0 0 1px rgba(150,105,30,0.15)",
        opacity: inView ? 1 : 0,
        transform: inView
          ? "translateX(0) rotate(0deg)"
          : `translateX(${isRight ? 28 : -28}px) rotate(${isRight ? 3 : -3}deg)`,
        transition: "opacity 650ms ease-out, transform 700ms cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      <EnvelopeTexture />

      {item.photo && (
        <img
          src={item.photo}
          alt=""
          className="absolute h-16 w-16 rounded-md object-cover sm:h-20 sm:w-20"
          style={{
            top: -12,
            ...(isRight ? { right: -10 } : { left: -10 }),
            transform: `rotate(${isRight ? 8 : -8}deg)`,
            boxShadow: "0 12px 22px -8px rgba(0,0,0,0.5), 0 0 0 4px #FFFCF3",
          }}
          draggable={false}
        />
      )}

      <div
        className="relative flex h-12 w-12 items-center justify-center rounded-full sm:h-14 sm:w-14"
        style={{ background: "linear-gradient(135deg, #FEF6E0, #E8C447)", boxShadow: "0 6px 14px -6px rgba(150,105,30,0.5)" }}
      >
        <StoryIcon kind={item.icon} size={22} color="#6b4d12" />
      </div>
      <span
        className="relative mt-3 block text-[12px] uppercase tracking-[0.26em]"
        style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, color: "var(--wax-gold-dark)" }}
      >
        {item.date}
      </span>
      <h3
        className="relative mt-0.5 text-[2.6rem] leading-[1.1] sm:text-5xl"
        style={{ fontFamily: "'Tangerine', cursive", fontWeight: 600, color: "#2a1f14" }}
      >
        {item.title}
      </h3>
      {item.paragraphs.map((p, pi) => (
        <p
          key={pi}
          className="relative mt-3 text-[15px] leading-relaxed sm:text-lg"
          style={{ fontFamily: "'Inter', sans-serif", fontWeight: 400, color: "#6b6156" }}
        >
          {p}
        </p>
      ))}
    </div>
  );

  return (
    <div ref={ref} className="flex w-full items-center gap-3 sm:gap-4">
      {isRight ? (
        <>
          <div className="min-w-3 flex-1" />
          {node}
          {card}
        </>
      ) : (
        <>
          {card}
          {node}
          <div className="min-w-3 flex-1" />
        </>
      )}
    </div>
  );
}

function OurStoryTimeline() {
  const [revealedCount, setRevealedCount] = useState(0);
  const [pathD, setPathD] = useState("");
  const [pathLength, setPathLength] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const hiddenPathRef = useRef<SVGPathElement>(null);
  const markers = useRef<(HTMLDivElement | null)[]>([]);

  const handleRevealed = (index: number) => {
    setRevealedCount((c) => Math.max(c, index + 1));
  };

  // Trace a smooth S through the actual, measured center of each heart —
  // so the curve always meets the markers exactly, at any screen size.
  const computePath = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const containerRect = container.getBoundingClientRect();
    const points = markers.current
      .map((el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2 - containerRect.left, y: r.top + r.height / 2 - containerRect.top };
      })
      .filter((p): p is { x: number; y: number } => p !== null);

    if (points.length < 2) return;
    let d = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const midY = (p0.y + p1.y) / 2;
      d += ` C ${p0.x},${midY} ${p1.x},${midY} ${p1.x},${p1.y}`;
    }
    setPathD(d);
  }, []);

  // Refs attach before layout effects run, so by here every heart is in the
  // DOM and measurable — one authoritative pass, no re-entrant timing races.
  useLayoutEffect(() => {
    computePath();
  }, [computePath]);

  useEffect(() => {
    window.addEventListener("resize", computePath);
    return () => window.removeEventListener("resize", computePath);
  }, [computePath]);

  useEffect(() => {
    if (hiddenPathRef.current) setPathLength(hiddenPathRef.current.getTotalLength());
  }, [pathD]);

  const progress = revealedCount / STORY.length;

  return (
    <section className="relative overflow-hidden px-4 py-14 sm:py-20" style={{ background: "#FFF9EF" }}>

      <div className="mx-auto flex max-w-2xl flex-col items-center">
        <span
          className="text-[12px] uppercase tracking-[0.34em]"
          style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, color: "var(--wax-gold-dark)" }}
        >
          Nuestra Historia
        </span>
        <h2
          className="mt-2 text-6xl sm:text-7xl"
          style={{ fontFamily: "'Tangerine', cursive", fontWeight: 500, color: "#2a1f14" }}
        >
          Cómo llegamos aquí
        </h2>

        <div ref={containerRef} className="relative mt-16 w-full">
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
            <path d={pathD} fill="none" stroke="rgba(150,105,30,0.16)" strokeWidth="2" />
            <path
              ref={hiddenPathRef}
              d={pathD}
              fill="none"
              stroke="var(--wax-gold)"
              strokeWidth="2.5"
              strokeLinecap="round"
              style={{
                strokeDasharray: pathLength || undefined,
                strokeDashoffset: pathLength ? pathLength * (1 - progress) : undefined,
                transition: "stroke-dashoffset 700ms ease-out",
              }}
            />
          </svg>

          <div className="flex flex-col gap-14 sm:gap-16">
            {STORY.map((item, i) => (
              <TimelineRow
                key={i}
                index={i}
                item={item}
                markerRef={(el) => {
                  markers.current[i] = el;
                }}
                onRevealed={handleRevealed}
              />
            ))}
          </div>
        </div>

        <StoryClosing />
      </div>
    </section>
  );
}

function StoryClosing() {
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="mt-16 flex max-w-xl flex-col items-center text-center sm:mt-20">
      {STORY_CLOSING.map((p, i) => (
        <p
          key={i}
          className="mt-3.5 text-[15px] leading-relaxed sm:text-lg"
          style={{
            fontFamily: "'Inter', sans-serif",
            color: "#6b6156",
            opacity: inView ? 1 : 0,
            transform: inView ? "translateY(0)" : "translateY(14px)",
            transition: `opacity 600ms ease-out ${i * 120}ms, transform 600ms ease-out ${i * 120}ms`,
          }}
        >
          {p}
        </p>
      ))}

      <p
        className="mt-7 text-3xl leading-snug sm:text-4xl"
        style={{
          fontFamily: "'Tangerine', cursive",
          fontWeight: 600,
          color: "var(--wax-gold-dark)",
          opacity: inView ? 1 : 0,
          transform: inView ? "translateY(0)" : "translateY(14px)",
          transition: `opacity 600ms ease-out ${STORY_CLOSING.length * 120}ms, transform 600ms ease-out ${STORY_CLOSING.length * 120}ms`,
        }}
      >
        Este no es solo un anuncio. Es el inicio de una familia que seguirá creciendo.
      </p>

      <div
        className="mt-4 h-px w-16"
        style={{
          background: "var(--wax-gold)",
          opacity: inView ? 1 : 0,
          transition: `opacity 500ms ease-out ${(STORY_CLOSING.length + 1) * 120}ms`,
        }}
      />

      <p
        className="mt-4 text-7xl sm:text-8xl"
        style={{
          fontFamily: "'Tangerine', cursive",
          color: "#2a1f14",
          lineHeight: 1.1,
          opacity: inView ? 1 : 0,
          transform: inView ? "translateY(0) scale(1)" : "translateY(16px) scale(0.94)",
          transition: `opacity 650ms ease-out ${(STORY_CLOSING.length + 2) * 120}ms, transform 650ms cubic-bezier(.34,1.56,.64,1) ${(STORY_CLOSING.length + 2) * 120}ms`,
        }}
      >
        Guarda la fecha
      </p>
      <p
        className="mt-1 text-[15px] italic sm:text-lg"
        style={{
          fontFamily: "'Inter', sans-serif",
          color: "#7a7264",
          opacity: inView ? 1 : 0,
          transition: `opacity 600ms ease-out ${(STORY_CLOSING.length + 3) * 120}ms`,
        }}
      >
        La historia continúa… y queremos que seas parte de ella.
      </p>
    </div>
  );
}

const WEDDING_DATE = new Date(2026, 11, 13, 0, 0, 0);

function getTimeLeft(target: Date) {
  const diff = Math.max(0, target.getTime() - Date.now());
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff / 3600000) % 24),
    minutes: Math.floor((diff / 60000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

// Starts at all-zeros (identical on server and first client paint) and only
// switches to the real, "now"-dependent countdown once mounted client-side —
// keeps SSR and hydration in sync instead of fighting the clock.
function useCountdown(target: Date) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    setTimeLeft(getTimeLeft(target));
    const id = setInterval(() => setTimeLeft(getTimeLeft(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  return timeLeft;
}

function CountdownUnit({ value, label, digits = 2 }: { value: number; label: string; digits?: number }) {
  const display = String(value).padStart(digits, "0");
  return (
    <div
      className="flex flex-col items-center justify-center rounded-2xl"
      style={{
        width: "clamp(66px, 18vw, 88px)",
        aspectRatio: "1 / 1",
        background: "linear-gradient(160deg, #FBF0D2 0%, #F3DFA0 100%)",
        boxShadow: "0 14px 28px -16px rgba(150,105,30,0.35), 0 0 0 1px rgba(150,105,30,0.12)",
      }}
    >
      <div style={{ perspective: "220px" }}>
        <span
          key={display}
          className="digit-flip block text-center"
          style={{
            fontFamily: "'Tangerine', cursive",
            fontWeight: 700,
            // Script numerals need noticeably more size than serif ones to
            // stay glanceable inside a small tile.
            fontSize: "clamp(40px, 10vw, 52px)",
            lineHeight: 1,
            color: "#7a5c2e",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {display}
        </span>
      </div>
      <span
        className="mt-1 text-[11px] uppercase tracking-[0.15em] sm:text-[11px]"
        style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, color: "#4a7ba6" }}
      >
        {label}
      </span>
    </div>
  );
}

const WEEKDAY_LABELS = ["D", "L", "M", "M", "J", "V", "S"];

function MiniCalendar({ inView }: { inView: boolean }) {
  const year = WEDDING_DATE.getFullYear();
  const month = WEDDING_DATE.getMonth();
  const targetDay = WEDDING_DATE.getDate();
  const firstWeekday = new Date(year, month, 1).getDay(); // Sunday = 0, matches D L M M J V S
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();
  const monthLabel = WEDDING_DATE.toLocaleDateString("es-ES", { month: "long", year: "numeric" });

  const leading = Array.from({ length: firstWeekday }, (_, i) => prevMonthDays - firstWeekday + i + 1);
  const current = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const trailingCount = (7 - ((leading.length + current.length) % 7)) % 7;
  const trailing = Array.from({ length: trailingCount }, (_, i) => i + 1);

  return (
    <div
      className="w-full max-w-sm rounded-2xl px-5 py-5 sm:px-7 sm:py-6"
      style={{ background: "#FFFCF3", boxShadow: "0 20px 44px -18px rgba(60,45,15,0.3), 0 0 0 1px rgba(150,105,30,0.12)" }}
    >
      <p
        className="text-3xl capitalize sm:text-4xl"
        style={{ fontFamily: "'Tangerine', cursive", fontWeight: 600, color: "#7a5c2e" }}
      >
        {monthLabel}
      </p>
      <div className="mt-4 grid grid-cols-7 gap-y-3 text-center">
        {WEEKDAY_LABELS.map((d, i) => (
          <span
            key={i}
            className="text-xs sm:text-sm"
            style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, color: "#4a7ba6" }}
          >
            {d}
          </span>
        ))}
        {leading.map((day, i) => (
          <span key={`lead-${i}`} className="text-xs sm:text-sm" style={{ color: "#d8d2c2" }}>
            {day}
          </span>
        ))}
        {current.map((day) => {
          const isTarget = day === targetDay;
          return (
            <div key={day} className="flex items-center justify-center">
              {isTarget ? (
                <span
                  className="relative flex h-8 w-8 items-center justify-center rounded-lg text-sm sm:h-9 sm:w-9 sm:text-base"
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 700,
                    color: "#5a4212",
                    background: "linear-gradient(160deg, #FCEEB0, #E8C447)",
                    boxShadow: "0 8px 16px -8px rgba(150,105,30,0.5)",
                  }}
                >
                  <span
                    className="calendar-pulse absolute inset-0 rounded-lg"
                    style={{ boxShadow: "0 0 0 0 rgba(232,196,71,0.5)", animationPlayState: inView ? "running" : "paused" }}
                  />
                  <span className="absolute -top-2.5 right-[-5px]">
                    <Heart size={11} color="#d64545" />
                  </span>
                  <span className="relative">{day}</span>
                </span>
              ) : (
                <span className="text-xs sm:text-sm" style={{ color: "#8a8a8a" }}>
                  {day}
                </span>
              )}
            </div>
          );
        })}
        {trailing.map((day, i) => (
          <span key={`trail-${i}`} className="text-xs sm:text-sm" style={{ color: "#d8d2c2" }}>
            {day}
          </span>
        ))}
      </div>
    </div>
  );
}

function CountdownSection() {
  const [inView, setInView] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const { days, hours, minutes, seconds } = useCountdown(WEDDING_DATE);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const reveal = (delayMs: number) => ({
    opacity: inView ? 1 : 0,
    transform: inView ? "translateY(0)" : "translateY(18px)",
    transition: `opacity 600ms ease-out ${delayMs}ms, transform 600ms cubic-bezier(.34,1.56,.64,1) ${delayMs}ms`,
  });

  return (
    <section ref={sectionRef} className="relative overflow-hidden px-4 py-14 sm:py-20" style={{ background: "#FFF9EF" }}>
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-10 sm:flex-row sm:items-start sm:justify-center sm:gap-16">
        <div className="flex flex-col items-center sm:items-start" style={reveal(100)}>
          <span
            className="text-[12px] uppercase tracking-[0.34em]"
            style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, color: "#4a7ba6" }}
          >
            Cuenta regresiva
          </span>
          <h2
            className="mt-2 text-4xl sm:text-5xl"
            style={{ fontFamily: "'Tangerine', cursive", fontWeight: 600, color: "#2c4a68" }}
          >
            Faltan solo...
          </h2>

          <div className="mt-8 flex items-center gap-3 sm:gap-4">
            <CountdownUnit value={days} label="Días" digits={days > 99 ? 3 : 2} />
            <CountdownUnit value={hours} label="Hrs" />
            <CountdownUnit value={minutes} label="Min" />
            <CountdownUnit value={seconds} label="Seg" />
          </div>
        </div>

        <div style={reveal(220)}>
          <MiniCalendar inView={inView} />
        </div>
      </div>
    </section>
  );
}

const VENUE_NAME = "Bellanova Jardín y Salones";
const VENUE_ADDRESS = "Carretera Panamericana, San Miguel, El Salvador";
const MAPS_URL = "https://maps.app.goo.gl/ZNp6PpUGpaaNvZcs7";
const ROUTE_D = "M22,168 C 90,168 55,64 150,52 C 218,44 232,70 262,42";

function ClockIcon({ size = 20, color = "#8a6a2a" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" stroke={color} strokeWidth="1.8" />
      <path d="M12 7v5.2l3.6 2.1" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PinIcon({ size = 20, color = "#8a6a2a" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 26" fill="none" aria-hidden="true">
      <path
        d="M12 2C6.9 2 3 5.9 3 10.5C3 17 12 24 12 24C12 24 21 17 21 10.5C21 5.9 17.1 2 12 2Z"
        fill={color}
      />
      <circle cx="12" cy="10.3" r="3.6" fill="#FFFCF3" />
    </svg>
  );
}

function InfoRow({ icon, label, value, sub }: { icon: "clock" | "pin"; label: string; value: string; sub: string }) {
  return (
    <div className="flex items-start gap-4">
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
        style={{ background: "linear-gradient(160deg, #FEF6E0, #E8C447)", boxShadow: "0 8px 16px -8px rgba(150,105,30,0.5)" }}
      >
        {icon === "clock" ? <ClockIcon size={19} color="#6b4d12" /> : <PinIcon size={17} color="#6b4d12" />}
      </div>
      <div>
        <p className="text-[12px] uppercase tracking-[0.22em]" style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, color: "#4a7ba6" }}>
          {label}
        </p>
        <p className="mt-0.5 text-[2rem] leading-tight sm:text-4xl" style={{ fontFamily: "'Tangerine', cursive", fontWeight: 600, color: "#2a1f14" }}>
          {value}
        </p>
        <p className="mt-0.5 text-sm" style={{ fontFamily: "'Inter', sans-serif", color: "#7a7264" }}>
          {sub}
        </p>
      </div>
    </div>
  );
}

// A little journey, not a pin drop — the car drives the dashed route once and
// the pin gives a small bounce right as it arrives (SMIL keeps both in sync
// without any JS animation-loop bookkeeping).
function RouteMap({ inView }: { inView: boolean }) {
  return (
    <div
      className="relative mx-auto overflow-hidden rounded-2xl"
      style={{
        width: 300,
        height: 210,
        maxWidth: "100%",
        background: "#EAF2F8",
        backgroundImage:
          "linear-gradient(rgba(120,173,212,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(120,173,212,0.18) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
        boxShadow: "0 20px 44px -20px rgba(40,80,120,0.35), 0 0 0 1px rgba(120,173,212,0.3)",
      }}
    >
      <svg viewBox="0 0 300 210" width={300} height={210} className="absolute inset-0">
        <path d={ROUTE_D} fill="none" stroke="#78ADD4" strokeWidth="3" strokeDasharray="7 8" strokeLinecap="round" opacity="0.8" />
        <circle cx="22" cy="168" r="5" fill="#78ADD4" />
        <text x="26" y="190" textAnchor="middle" fontSize="12" fill="#4a7ba6" fontFamily="Inter, sans-serif" fontWeight={600}>
          Tu hogar
        </text>
      </svg>

      {/* the car — travels the dashed road via a CSS motion path, turning to face the curve as it goes */}
      <div
        className={`route-car ${inView ? "route-car-drive" : ""}`}
        style={{ position: "absolute", left: 0, top: 0, width: 26, height: 20, offsetPath: `path("${ROUTE_D}")` } as CSSProperties}
      >
        <svg viewBox="0 0 26 20" width="26" height="20">
          <rect x="0" y="5" width="26" height="12" rx="4" fill="#E8C447" stroke="#8a6a2a" strokeWidth="1" />
          <rect x="5" y="0" width="16" height="8" rx="3" fill="#FFFCF3" stroke="#8a6a2a" strokeWidth="1" />
          <circle cx="6.5" cy="18" r="2.6" fill="#3a2f1a" />
          <circle cx="19.5" cy="18" r="2.6" fill="#3a2f1a" />
        </svg>
      </div>

      {/* destination pin — bounces once the car pulls in */}
      <div
        className={`route-pin ${inView ? "route-pin-arrive" : ""}`}
        style={{ position: "absolute", left: 262, top: 42 }}
      >
        <PinIcon size={30} color="#d64545" />
      </div>

      {/* Venue label sits below the pin, clear of where the car parks. Pulled
          in from the right edge so the box can't be clipped by the map frame,
          and set in Inter — a 10px script here was unreadable. */}
      <div
        className="absolute px-2 py-1 text-center text-[11px] leading-tight"
        style={{
          left: 232,
          top: 80,
          transform: "translate(-50%, 0)",
          width: 124,
          fontFamily: "'Inter', sans-serif",
          fontWeight: 600,
          color: "#2a1f14",
          background: "rgba(255,252,243,0.94)",
          borderRadius: "6px",
          boxShadow: "0 2px 6px rgba(60,45,15,0.18)",
        }}
      >
        {VENUE_NAME}
      </div>
    </div>
  );
}

function CeremonySection() {
  const [inView, setInView] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const reveal = (delayMs: number) => ({
    opacity: inView ? 1 : 0,
    transform: inView ? "translateY(0)" : "translateY(18px)",
    transition: `opacity 600ms ease-out ${delayMs}ms, transform 600ms cubic-bezier(.34,1.56,.64,1) ${delayMs}ms`,
  });

  return (
    <section ref={sectionRef} className="relative overflow-hidden px-4 py-14 sm:py-20" style={{ background: "#FFF9EF" }}>
      <div className="mx-auto flex max-w-4xl flex-col items-center">
        <span
          className="text-[12px] uppercase tracking-[0.34em]"
          style={{ fontFamily: "'Inter', sans-serif", fontWeight: 500, color: "var(--wax-gold-dark)" }}
        >
          La ceremonia
        </span>
        <h2
          className="mt-2 text-4xl sm:text-5xl"
          style={{ fontFamily: "'Tangerine', cursive", fontWeight: 500, color: "#2a1f14" }}
        >
          Nos vemos allí
        </h2>

        <div className="mt-12 grid w-full items-center gap-10 sm:grid-cols-2 sm:gap-14">
          <div className="flex flex-col gap-7" style={reveal(100)}>
            <InfoRow icon="clock" label="Hora" value="4:00 PM" sub="Sábado, 13 de diciembre" />
            <InfoRow icon="pin" label="Lugar" value={VENUE_NAME} sub={VENUE_ADDRESS} />
            <a
              href={MAPS_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex w-fit items-center gap-2 rounded-full px-5 py-2.5 text-xs uppercase tracking-[0.2em] text-white transition duration-200 ease-out hover:scale-105 hover:shadow-lg active:scale-95"
              style={{ background: "linear-gradient(135deg, var(--wax-gold-light), var(--wax-gold-dark))", fontFamily: "'Inter', sans-serif", fontWeight: 600 }}
            >
              <PinIcon size={13} color="#fff" />
              Ver en Google Maps
            </a>
          </div>

          <div style={reveal(220)}>
            <RouteMap inView={inView} />
          </div>
        </div>
      </div>
    </section>
  );
}

const AVOID_COLORS = [
  { id: "blanco", color: "#FFFFFF", label: "Blanco" },
  { id: "azul-cielo", color: "#A7D5F6", label: "Azul cielo" },
  { id: "azul", color: "#78ADD4", label: "Azul" },
  { id: "amarillo", color: "#FAE186", label: "Amarillo" },
] as const;

const RECOMMENDED_COLORS = [
  { id: "verde-salvia", color: "#9CAF88", label: "Verde salvia" },
  { id: "rosa-palo", color: "#D9A9A0", label: "Rosa palo" },
  { id: "champan", color: "#D8C9A3", label: "Champán" },
] as const;

function DressCodeIcon({ size = 30, color = "#6b4d12" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 36" fill="none" aria-hidden="true">
      {/* dress — bodice tapering to a flared skirt */}
      <path
        d="M13.4 3.5c0 1.4-1.7 2.1-1.7 3.7 0 1 .6 1.8 1.7 2.3L7.5 24.5h11.8L13.7 9.5c1.1-.5 1.7-1.3 1.7-2.3 0-1.6-1.7-2.3-1.7-3.7"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* tuxedo jacket with lapels + bowtie */}
      <path
        d="M29.3 6.2 33 3.6l3.6 2.6-1.8 2.7L37.5 24.5H25.2l2.7-15.6-1.8-2.7Z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path d="M31 8.6c.7.7 1.3.7 2 0" stroke={color} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function ColorCluster({
  colors,
  inView,
  baseDelay,
  size,
}: {
  colors: readonly { id: string; color: string; label: string }[];
  inView: boolean;
  baseDelay: number;
  size: number;
}) {
  const overlap = size * 0.36;
  return (
    <div className="flex" role="list" aria-label="Colores a evitar">
      {colors.map((c, i) => (
        <div
          key={c.id}
          role="listitem"
          aria-label={c.label}
          title={c.label}
          className="rounded-full"
          style={{
            width: size,
            height: size,
            marginLeft: i === 0 ? 0 : -overlap,
            background: c.color,
            border: "3px solid #FFF9EF",
            boxShadow: "0 10px 20px -8px rgba(60,45,15,0.45), 0 0 0 1px rgba(60,45,15,0.08)",
            zIndex: colors.length - i,
            position: "relative",
            opacity: inView ? 1 : 0,
            transform: inView ? "scale(1) translateY(0)" : "scale(0.25) translateY(20px)",
            transition: `opacity 420ms ease-out ${baseDelay + i * 110}ms, transform 600ms cubic-bezier(.34,1.56,.64,1) ${baseDelay + i * 110}ms`,
          }}
        />
      ))}
    </div>
  );
}

function DressCodeSection() {
  const [inView, setInView] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="relative overflow-hidden px-4 py-16 sm:py-24" style={{ background: "#FFF9EF" }}>
      <div className="mx-auto flex max-w-lg flex-col items-center text-center">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full"
          style={{
            background: "linear-gradient(160deg, #FEF6E0, #E8C447)",
            boxShadow: "0 12px 22px -10px rgba(150,105,30,0.55)",
            opacity: inView ? 1 : 0,
            transform: inView ? "translateY(0) scale(1)" : "translateY(-12px) scale(0.75)",
            transition: "opacity 450ms ease-out, transform 600ms cubic-bezier(.34,1.56,.64,1)",
          }}
        >
          <DressCodeIcon size={32} />
        </div>

        <span
          className="mt-5 text-[12px] uppercase tracking-[0.34em]"
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 500,
            color: "var(--wax-gold-dark)",
            opacity: inView ? 1 : 0,
            transition: "opacity 450ms ease-out 100ms",
          }}
        >
          Código de vestimenta
        </span>
        <h2
          className="text-7xl sm:text-8xl"
          style={{
            fontFamily: "'Tangerine', cursive",
            color: "#2a1f14",
            lineHeight: 1.15,
            opacity: inView ? 1 : 0,
            transform: inView ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 550ms ease-out 150ms, transform 550ms ease-out 150ms",
          }}
        >
          ¿Qué me pongo?
        </h2>
        <p
          className="mt-3 max-w-md text-[15px] sm:text-lg"
          style={{
            fontFamily: "'Inter', sans-serif",
            color: "#7a7264",
            opacity: inView ? 1 : 0,
            transition: "opacity 500ms ease-out 280ms",
          }}
        >
          Hemos preparado esta celebración con mucho cariño; agradecemos que eviten esta gama de colores:
          blanco, azul cielo, azul y amarillo — van reservados para la novia y el cortejo.
        </p>

        <div className="mt-11">
          <ColorCluster colors={AVOID_COLORS} inView={inView} baseDelay={350} size={76} />
        </div>

        <div
          className="mt-7 flex items-center gap-2.5"
          style={{ opacity: inView ? 1 : 0, transition: "opacity 500ms ease-out 850ms" }}
        >
          <div className="flex -space-x-1.5">
            {RECOMMENDED_COLORS.map((c) => (
              <span
                key={c.id}
                className="h-3.5 w-3.5 rounded-full"
                style={{ background: c.color, boxShadow: "0 0 0 2px #FFF9EF, 0 0 0 3px rgba(60,45,15,0.12)" }}
              />
            ))}
          </div>
          <span className="text-xs" style={{ fontFamily: "'Inter', sans-serif", color: "#7a7264" }}>
            Recomendado: verde salvia, rosa palo y champán
          </span>
        </div>
      </div>
    </section>
  );
}

function EnvelopeGlyph({ size = 30, color = "#6b4d12" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size * 0.74} viewBox="0 0 32 24" fill="none" aria-hidden="true">
      <rect x="1.2" y="1.2" width="29.6" height="21.6" rx="2.6" stroke={color} strokeWidth="1.8" />
      <path d="M2.2 2.6 16 14.2 29.8 2.6" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function GiftSection() {
  const [inView, setInView] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden px-4 py-16 sm:py-24"
      style={{ background: "linear-gradient(180deg, #FFF9EF 0%, #FBF0D8 100%)" }}
    >
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full"
          style={{
            background: "linear-gradient(160deg, #FEF6E0, #E8C447)",
            boxShadow: "0 12px 22px -10px rgba(150,105,30,0.55)",
            opacity: inView ? 1 : 0,
            transform: inView ? "translateY(0) scale(1)" : "translateY(-12px) scale(0.75)",
            transition: "opacity 450ms ease-out, transform 600ms cubic-bezier(.34,1.56,.64,1)",
          }}
        >
          <EnvelopeGlyph size={30} />
        </div>

        <span
          className="mt-5 text-[12px] uppercase tracking-[0.34em]"
          style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 500,
            color: "var(--wax-gold-dark)",
            opacity: inView ? 1 : 0,
            transition: "opacity 450ms ease-out 100ms",
          }}
        >
          Regalos
        </span>
        <h2
          className="text-7xl sm:text-8xl"
          style={{
            fontFamily: "'Tangerine', cursive",
            color: "#2a1f14",
            lineHeight: 1.15,
            opacity: inView ? 1 : 0,
            transform: inView ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 550ms ease-out 150ms, transform 550ms ease-out 150ms",
          }}
        >
          Lluvia de sobres
        </h2>
        <p
          className="mt-3 max-w-sm text-[15px] sm:text-lg"
          style={{
            fontFamily: "'Inter', sans-serif",
            color: "#7a7264",
            opacity: inView ? 1 : 0,
            transition: "opacity 500ms ease-out 280ms",
          }}
        >
          El mayor regalo será compartir este día contigo. Si deseas contribuir al inicio de nuestra nueva
          etapa, puedes hacerlo mediante una lluvia de sobres.
        </p>
      </div>
    </section>
  );
}

function PersonCheckIcon({ size = 20, color = "#6b4d12" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="10" cy="8" r="3.4" stroke={color} strokeWidth="1.8" />
      <path d="M3.5 20c0-3.6 2.9-6.5 6.5-6.5s6.5 2.9 6.5 6.5" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M16 12.8l1.8 1.8L21.5 11" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type RsvpStatus = "idle" | "sending" | "sent" | "error";

function RsvpSection({ guestName }: { guestName?: string }) {
  // Pre-filled from the ?invitado= link so a personalized invitation doesn't
  // make the guest retype the name we already addressed the envelope to.
  const [name, setName] = useState(guestName ?? "");
  const [attending, setAttending] = useState<"yes" | "no" | null>(null);
  const [status, setStatus] = useState<RsvpStatus>("idle");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !attending || status === "sending") return;

    setStatus("sending");
    try {
      const payload = new FormData();
      payload.append(GOOGLE_FORM_ENTRY_NOMBRE, name.trim());
      // Must match one of the Google Form's option strings exactly for it to
      // register as a selected choice rather than a blank answer.
      payload.append(GOOGLE_FORM_ENTRY_ASISTENCIA, attending === "yes" ? "Asistiré" : "No podré asistir");

      // Google Forms doesn't send CORS headers on its response, so the browser
      // can't read it — "no-cors" is the standard workaround. The submission
      // still reaches the sheet; we just can't inspect the result.
      await fetch(GOOGLE_FORM_ACTION_URL, { method: "POST", body: payload, mode: "no-cors" });
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  return (
    <section className="relative px-4 py-14 sm:py-20" style={{ background: "linear-gradient(180deg, #FBF0D8 0%, #FDEFD3 100%)" }}>
      <div className="mx-auto max-w-md">
        <div
          className="relative rounded-[28px] px-6 py-10 text-center sm:px-10"
          style={{ background: "#FFFDF7", boxShadow: "0 30px 50px -24px rgba(120,90,30,0.35), 0 0 0 1px rgba(150,105,30,0.08)" }}
        >
          <div
            className="absolute -top-6 left-1/2 flex h-12 w-12 -translate-x-1/2 items-center justify-center rounded-2xl"
            style={{ background: "linear-gradient(160deg, #FEF6E0, #E8C447)", boxShadow: "0 10px 20px -10px rgba(150,105,30,0.55)" }}
          >
            <PersonCheckIcon size={22} />
          </div>

          {status === "sent" ? (
            <div className="py-6">
              <h2 className="text-3xl sm:text-4xl" style={{ fontFamily: "'Tangerine', cursive", fontWeight: 500, color: "#2a1f14" }}>
                ¡Gracias, {name.trim()}!
              </h2>
              <p className="mt-3 text-sm sm:text-base" style={{ fontFamily: "'Inter', sans-serif", color: "#7a7264" }}>
                {attending === "yes"
                  ? "Tu confirmación ya quedó registrada. Nos vemos en la boda."
                  : "Gracias por avisarnos. Te vamos a extrañar ese día."}
              </p>
            </div>
          ) : (
            <>
              <h2 className="mt-1 text-4xl sm:text-5xl" style={{ fontFamily: "'Tangerine', cursive", fontWeight: 500, color: "#2a1f14" }}>
                Confirma tu asistencia
              </h2>
              <p className="mt-2 text-[15px] italic sm:text-lg" style={{ fontFamily: "'Inter', sans-serif", color: "#7a7264" }}>
                {guestName
                  ? `Nos encantaría que nos acompañes en este día tan especial, ${guestName}.`
                  : "Nos encantaría que nos acompañaras en este día tan especial."}
              </p>

              <form onSubmit={handleSubmit} className="mt-8 text-left">
                <label
                  htmlFor="rsvp-name"
                  className="text-[12px] uppercase tracking-[0.22em]"
                  style={{ fontFamily: "'Inter', sans-serif", fontWeight: 600, color: "#4a7ba6" }}
                >
                  Nombre del invitado
                </label>
                <input
                  id="rsvp-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Escribe tu nombre"
                  // A field someone has to read back what they typed in is
                  // functional text, not decorative — the script face made it
                  // faint and hard to proofread, so this one stays plain. 16px
                  // also stops iOS from zooming the page on focus.
                  className="mt-2 w-full border-0 border-b bg-transparent pb-2 text-base outline-none focus:border-b-2"
                  style={{
                    fontFamily: "'Inter', sans-serif",
                    color: "#2a1f14",
                    borderColor: "rgba(150,105,30,0.3)",
                  }}
                />

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAttending("yes")}
                    aria-pressed={attending === "yes"}
                    className="rounded-xl py-3 text-xs uppercase tracking-[0.15em] transition duration-200"
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontWeight: 600,
                      color: attending === "yes" ? "#6b4d12" : "#7a7264",
                      background: attending === "yes" ? "linear-gradient(160deg, #FEF6E0, #F3DFA0)" : "transparent",
                      border: `1.5px solid ${attending === "yes" ? "var(--wax-gold-dark)" : "rgba(150,105,30,0.25)"}`,
                    }}
                  >
                    Asistiré
                  </button>
                  <button
                    type="button"
                    onClick={() => setAttending("no")}
                    aria-pressed={attending === "no"}
                    className="rounded-xl py-3 text-xs uppercase tracking-[0.15em] transition duration-200"
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontWeight: 600,
                      color: attending === "no" ? "#6b4d12" : "#7a7264",
                      background: attending === "no" ? "linear-gradient(160deg, #FEF6E0, #F3DFA0)" : "transparent",
                      border: `1.5px solid ${attending === "no" ? "var(--wax-gold-dark)" : "rgba(150,105,30,0.25)"}`,
                    }}
                  >
                    No podré ir
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={!name.trim() || !attending || status === "sending"}
                  className="mt-6 w-full rounded-full py-3.5 text-xs uppercase tracking-[0.2em] text-white transition duration-200 ease-out hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                  style={{
                    background: "linear-gradient(135deg, var(--wax-gold-light), var(--wax-gold-dark))",
                    fontFamily: "'Inter', sans-serif",
                    fontWeight: 600,
                  }}
                >
                  {status === "sending" ? "Enviando..." : "Enviar confirmación"}
                </button>

                {status === "error" && (
                  <p className="mt-3 text-center text-sm" style={{ fontFamily: "'Inter', sans-serif", color: "#c0564f" }}>
                    No se pudo enviar. Revisa tu conexión e intenta de nuevo.
                  </p>
                )}
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
