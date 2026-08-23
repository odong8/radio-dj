import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { generateRadioScript, synthesizeRadioAudio, type DjMode, type Mood, type RadioScript } from "@/lib/radioApi";
import { cn } from "@/lib/utils";
import {
  Archive,
  ChevronRight,
  CircleDot,
  Disc3,
  Headphones,
  Heart,
  Loader2,
  Mic2,
  Music2,
  Play,
  Radio,
  RotateCcw,
  Sparkles,
  Square,
  Star,
  Trash2,
  Volume2,
  VolumeX,
  Waves,
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const moods = [
  { value: "잔잔해요", hint: "파도 낮은 밤" },
  { value: "답답해요", hint: "창문 열고 싶은 밤" },
  { value: "들떠요", hint: "잠이 달아난 밤" },
  { value: "피곤해요", hint: "이불이 부르는 밤" },
  { value: "멍해요", hint: "별을 세는 밤" },
] as const;

const djModes = [
  {
    name: "다정한 밤참",
    description: "포근한 온기로 하루를 천천히 감싸는 DJ",
    voiceName: "Lily",
    voiceProfile: "여성 · 30대 · 낮고 벨벳 같은 음색",
    previewUrl: "/audio/dj-preview-warm.mp3",
    icon: Heart,
    accent: "from-orange-300 to-rose-400",
  },
  {
    name: "과몰입 새벽",
    description: "사소한 순간을 영화처럼 과장해 주는 DJ",
    voiceName: "Liam",
    voiceProfile: "남성 · 20대 · 밝고 에너지 있는 음색",
    previewUrl: "/audio/dj-preview-dramatic-male.mp3",
    icon: Sparkles,
    accent: "from-fuchsia-400 to-violet-500",
  },
  {
    name: "엉뚱한 우주",
    description: "우주 관제센터에서 신호를 받는 DJ",
    voiceName: "River",
    voiceProfile: "중성 · 30대 · 몽환적인 중저음",
    previewUrl: "/audio/dj-preview-cosmic.mp3",
    icon: Disc3,
    accent: "from-cyan-300 to-blue-500",
  },
  {
    name: "차분한 응원",
    description: "작은 다음 걸음을 함께 찾는 DJ",
    voiceName: "Chris",
    voiceProfile: "남성 · 30대 · 부드럽고 안정적인 중저음",
    previewUrl: "/audio/dj-preview-calm-male.mp3",
    icon: Headphones,
    accent: "from-emerald-300 to-teal-500",
  },
] as const;

type Episode = RadioScript & { id: string; mood: Mood; energy: number; mode: DjMode; story: string; createdAt: number };

const ARCHIVE_KEY = "room-radio-dj-episodes-v1";
const FAVORITE_EPISODES_KEY = "room-radio-dj-favorite-episodes-v1";
const FAVORITE_DJS_KEY = "room-radio-dj-favorite-djs-v1";
const MAX_ARCHIVE_SIZE = 20;

const backgroundTracks: Record<Mood, { url: string; label: string }> = {
  "잔잔해요": { url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663074423754/WVTrOxlXacqiQBLy.mp3", label: "고요한 안개" },
  "답답해요": { url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663074423754/iMvNLgDUHFUHfDtg.mp3", label: "창문 너머의 공기" },
  "들떠요": { url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663074423754/MvBjRZudhSfHUfIL.mp3", label: "깨어 있는 불빛" },
  "피곤해요": { url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663074423754/qITwTIfPnYGnhbPs.mp3", label: "이불 속의 밤" },
  "멍해요": { url: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663074423754/bUDmnIRdjuPHTOva.mp3", label: "별을 세는 시간" },
};

function isEpisode(value: unknown): value is Episode {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return ["id", "title", "opening", "body", "closing", "mode", "story"].every(key => typeof item[key] === "string")
    && typeof item.createdAt === "number" && typeof item.energy === "number";
}

function readEpisodes(key: string) {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isEpisode).sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_ARCHIVE_SIZE) : [];
  } catch {
    return [];
  }
}

function saveEpisodes(key: string, episodes: Episode[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(episodes));
    return true;
  } catch {
    return false;
  }
}

function readFavoriteDjs(): DjMode[] {
  try {
    const raw = window.localStorage.getItem(FAVORITE_DJS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((mode): mode is DjMode => djModes.some(dj => dj.name === mode)) : [];
  } catch {
    return [];
  }
}

function saveFavoriteDjs(djs: DjMode[]) {
  try {
    window.localStorage.setItem(FAVORITE_DJS_KEY, JSON.stringify(djs));
    return true;
  } catch {
    return false;
  }
}

function makeId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `episode-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getNowLabel(timestamp = Date.now()) {
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(timestamp);
}

function getDateLabel(timestamp: number) {
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(timestamp);
}

function Waveform() {
  return <div className="flex h-12 items-center justify-center gap-1.5" aria-label="방송 파형 애니메이션">{Array.from({ length: 12 }, (_, index) => <span key={index} className="radio-wave h-3 w-1.5 rounded-full bg-rose-300" style={{ animationDelay: `${index * 70}ms`, opacity: 0.58 + (index % 4) * 0.1 }} />)}</div>;
}

function EnergyDots({ value }: { value: number }) {
  return <div className="flex items-center gap-2" aria-label={`에너지 레벨 ${value} / 5`}>{Array.from({ length: 5 }, (_, index) => <span key={index} className={cn("h-2.5 w-2.5 rounded-full", index < value ? "bg-rose-300" : "bg-slate-700")} />)}</div>;
}

export default function Home() {
  const [mood, setMood] = useState<Mood>("잔잔해요");
  const [energy, setEnergy] = useState(3);
  const [mode, setMode] = useState<DjMode>("다정한 밤참");
  const [story, setStory] = useState("");
  const [storyError, setStoryError] = useState("");
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [archive, setArchive] = useState<Episode[]>([]);
  const [favoriteEpisodes, setFavoriteEpisodes] = useState<Episode[]>([]);
  const [favoriteDjs, setFavoriteDjs] = useState<DjMode[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shouldAutoPlay, setShouldAutoPlay] = useState(false);
  const [bgmEnabled, setBgmEnabled] = useState(true);
  const [previewingMode, setPreviewingMode] = useState<DjMode | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const resultRef = useRef<HTMLElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const backgroundAudioRef = useRef<HTMLAudioElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const generatedAudioUrlRef = useRef<string | null>(null);
  const generateMutation = { isPending: isGenerating };
  const synthesizeMutation = { isPending: isSynthesizing };

  useEffect(() => {
    setArchive(readEpisodes(ARCHIVE_KEY));
    setFavoriteEpisodes(readEpisodes(FAVORITE_EPISODES_KEY));
    setFavoriteDjs(readFavoriteDjs());
  }, []);

  useEffect(() => () => {
    audioRef.current?.pause();
    backgroundAudioRef.current?.pause();
    previewAudioRef.current?.pause();
    if (generatedAudioUrlRef.current) URL.revokeObjectURL(generatedAudioUrlRef.current);
  }, []);

  useEffect(() => {
    if (backgroundAudioRef.current) backgroundAudioRef.current.volume = isPlaying ? 0.06 : 0.16;
  }, [isPlaying]);

  useEffect(() => {
    if (!audioUrl || !shouldAutoPlay) return;
    void audioRef.current?.play().then(() => setShouldAutoPlay(false)).catch(() => {
      setShouldAutoPlay(false);
      toast.info("AI DJ 음성이 준비되었습니다. 재생 버튼을 눌러 들어 보세요.");
    });
  }, [audioUrl, shouldAutoPlay]);

  const startBackgroundMusic = () => {
    const bgm = backgroundAudioRef.current;
    if (!bgm || !bgmEnabled) return;
    bgm.volume = isPlaying ? 0.06 : 0.16;
    void bgm.play().catch(() => undefined);
  };

  const toggleBackgroundMusic = () => {
    const bgm = backgroundAudioRef.current;
    if (!bgm) return;
    if (bgmEnabled) {
      bgm.pause();
      setBgmEnabled(false);
      return;
    }
    setBgmEnabled(true);
    bgm.volume = isPlaying ? 0.06 : 0.16;
    void bgm.play().catch(() => toast.info("방송 시작 버튼을 누르면 배경 음악이 재생됩니다."));
  };

  const clearGeneratedAudio = () => {
    if (generatedAudioUrlRef.current) URL.revokeObjectURL(generatedAudioUrlRef.current);
    generatedAudioUrlRef.current = null;
    setAudioUrl(null);
  };

  const synthesizeEpisode = async (target: Episode, autoPlay = false) => {
    setIsSynthesizing(true);
    try {
      const url = await synthesizeRadioAudio({ mode: target.mode, script: { title: target.title, opening: target.opening, body: target.body, closing: target.closing } });
      if (generatedAudioUrlRef.current) URL.revokeObjectURL(generatedAudioUrlRef.current);
      generatedAudioUrlRef.current = url;
      setShouldAutoPlay(autoPlay);
      setAudioUrl(url);
      if (!autoPlay) toast.success("AI DJ 음성이 준비되었습니다.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI DJ 목소리를 만들지 못했습니다.");
    } finally {
      setIsSynthesizing(false);
    }
  };

  const playVoicePreview = (dj: (typeof djModes)[number]) => {
    const preview = previewAudioRef.current;
    if (!preview) return;
    if (previewingMode === dj.name) {
      preview.pause();
      setPreviewingMode(null);
      return;
    }
    preview.pause();
    preview.src = dj.previewUrl;
    preview.currentTime = 0;
    preview.volume = 0.9;
    void preview.play().then(() => setPreviewingMode(dj.name)).catch(() => toast.error("DJ 미리듣기를 재생하지 못했습니다."));
  };

  const toggleFavoriteDj = (djMode: DjMode) => {
    const next = favoriteDjs.includes(djMode) ? favoriteDjs.filter(item => item !== djMode) : [...favoriteDjs, djMode];
    setFavoriteDjs(next);
    if (!saveFavoriteDjs(next)) toast.error("DJ 즐겨찾기를 저장하지 못했습니다.");
  };

  const toggleFavoriteEpisode = (target: Episode) => {
    const next = favoriteEpisodes.some(item => item.id === target.id) ? favoriteEpisodes.filter(item => item.id !== target.id) : [target, ...favoriteEpisodes].slice(0, MAX_ARCHIVE_SIZE);
    setFavoriteEpisodes(next);
    if (!saveEpisodes(FAVORITE_EPISODES_KEY, next)) toast.error("방송 즐겨찾기를 저장하지 못했습니다.");
  };

  const requestGeneration = async (nextMode: DjMode = mode) => {
    const cleanedStory = story.trim();
    if (!cleanedStory) {
      setStoryError("오늘의 한 줄 사연을 적어 주세요.");
      return;
    }
    setStoryError("");
    startBackgroundMusic();
    setMode(nextMode);
    setIsGenerating(true);
    try {
      const script = await generateRadioScript({ mood, energy, mode: nextMode, story: cleanedStory });
      audioRef.current?.pause();
      clearGeneratedAudio();
      setIsPlaying(false);
      const next: Episode = { ...script, id: makeId(), mood, energy, mode: nextMode, story: cleanedStory, createdAt: Date.now() };
      setEpisode(next);
      void synthesizeEpisode(next, true);
      window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "방송 대사를 만들지 못했습니다.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void requestGeneration();
  };

  const saveEpisode = () => {
    if (!episode) return;
    const next = [episode, ...archive.filter(item => item.id !== episode.id)].slice(0, MAX_ARCHIVE_SIZE);
    setArchive(next);
    if (saveEpisodes(ARCHIVE_KEY, next)) toast.success("오늘의 방송을 보관함에 넣었습니다.");
    else toast.error("이 브라우저에서는 보관함을 저장하지 못했습니다.");
  };

  const removeEpisode = (id: string) => {
    const next = archive.filter(item => item.id !== id);
    setArchive(next);
    saveEpisodes(ARCHIVE_KEY, next);
    setSelectedEpisode(current => current?.id === id ? null : current);
  };

  const replayFavorite = (target: Episode) => {
    setMood(target.mood);
    setEnergy(target.energy);
    setMode(target.mode);
    setStory(target.story);
    setEpisode(target);
    clearGeneratedAudio();
    setIsPlaying(false);
    window.setTimeout(() => {
      startBackgroundMusic();
      void synthesizeEpisode(target, true);
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  };

  const toggleAudio = () => {
    if (!episode) return;
    if (!audioUrl) {
      void synthesizeEpisode(episode, true);
      return;
    }
    if (isPlaying) audioRef.current?.pause();
    else void audioRef.current?.play().catch(() => toast.error("오디오를 재생하지 못했습니다."));
  };

  const isSaved = episode ? archive.some(item => item.id === episode.id) : false;
  const isFavoriteEpisode = episode ? favoriteEpisodes.some(item => item.id === episode.id) : false;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#080d1d] text-slate-100 selection:bg-rose-300 selection:text-slate-950">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(120,74,163,.25),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(244,114,182,.13),transparent_26%),radial-gradient(circle_at_70%_80%,rgba(34,211,238,.12),transparent_26%)]" />
      <audio ref={backgroundAudioRef} src={backgroundTracks[mood].url} loop preload="auto" />
      <audio ref={previewAudioRef} preload="metadata" onEnded={() => setPreviewingMode(null)} />
      <main className="relative mx-auto max-w-[1180px] px-4 pb-16 pt-5 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <a href="#top" className="group flex items-center gap-3" aria-label="내 방의 라디오 DJ 홈"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-rose-300 to-violet-500 shadow-lg shadow-rose-950/30"><Radio className="h-5 w-5 text-slate-950" /></span><span><span className="block font-mono text-[10px] tracking-[0.2em] text-rose-200">ROOM 98.6 FM</span><strong className="font-[Gowun_Batang] text-lg font-bold text-white">내 방의 라디오 DJ</strong></span></a>
          <div className="flex items-center gap-2"><button type="button" onClick={toggleBackgroundMusic} className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-slate-300"><span>{bgmEnabled ? <Music2 className="h-3.5 w-3.5 text-cyan-200" /> : <VolumeX className="h-3.5 w-3.5" />}</span>BGM {bgmEnabled ? "ON" : "OFF"}</button><a href="#favorites" className="hidden rounded-full border border-amber-200/20 bg-amber-200/5 px-3.5 py-2 text-xs text-amber-100 sm:block">즐겨찾기 {favoriteEpisodes.length + favoriteDjs.length}</a><a href="#archive" className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-slate-300"><Archive className="h-3.5 w-3.5" />보관함 {String(archive.length).padStart(2, "0")}</a></div>
        </header>

        <section id="top" className="pb-8 pt-12 sm:pb-10 sm:pt-16"><p className="mb-3 flex items-center gap-2 font-mono text-[11px] tracking-[0.18em] text-rose-200"><CircleDot className="h-3.5 w-3.5" /> YOUR PRIVATE NIGHTLY BROADCAST</p><h1 className="max-w-3xl font-[Gowun_Batang] text-4xl font-bold leading-[1.25] text-white sm:text-5xl">지금, 당신의 방에서만<br /><span className="text-rose-200">들리는 작은 방송</span></h1><p className="mt-5 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">오늘의 마음을 한 줄 사연으로 보내면, 선택한 DJ가 심야 라디오의 주파수로 바꿔 드립니다.</p></section>

        <section className="grid items-start gap-5 lg:grid-cols-[0.96fr_1.04fr] lg:gap-7">
          <form onSubmit={handleSubmit} className="rounded-[2rem] border border-white/10 bg-[#10182e]/85 p-5 shadow-2xl shadow-black/20 backdrop-blur sm:p-7">
            <div className="mb-7 flex items-start justify-between"><div><p className="font-mono text-[11px] tracking-[0.18em] text-rose-200">LIVE STUDIO</p><h2 className="mt-1 font-[Gowun_Batang] text-2xl font-bold text-white">오늘의 주파수</h2></div><Volume2 className="mt-1 h-5 w-5 text-rose-300" /></div>
            <fieldset className="mb-7"><legend className="mb-3 text-sm font-semibold text-slate-200">1. 지금의 기분</legend><div className="flex flex-wrap gap-2">{moods.map(item => <button key={item.value} type="button" onClick={() => setMood(item.value)} className={cn("rounded-full border px-3 py-2 text-left text-xs transition", mood === item.value ? "border-rose-200/80 bg-rose-200 text-slate-950" : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/30")}><span className="block font-semibold">{item.value}</span><span className={cn("mt-0.5 block text-[10px]", mood === item.value ? "text-slate-700" : "text-slate-500")}>{item.hint}</span></button>)}</div></fieldset>
            <fieldset className="mb-7"><div className="mb-3 flex items-center justify-between"><legend className="text-sm font-semibold text-slate-200">2. 오늘의 에너지</legend><span className="font-mono text-xs text-rose-200">LEVEL {energy}</span></div><div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3"><span className="text-xs text-slate-500">낮음</span><div className="grid flex-1 grid-cols-5 gap-2">{[1, 2, 3, 4, 5].map(level => <button key={level} type="button" aria-label={`에너지 레벨 ${level}`} onClick={() => setEnergy(level)} className={cn("h-8 rounded-lg border transition", level <= energy ? "border-rose-300 bg-rose-300" : "border-slate-700 bg-slate-800/70")} />)}</div><span className="text-xs text-slate-500">높음</span></div></fieldset>
            <fieldset className="mb-7"><legend className="mb-3 text-sm font-semibold text-slate-200">3. 오늘의 DJ <span className="ml-1 font-normal text-slate-500">목소리를 먼저 들어 보세요</span></legend><div className="grid gap-2 sm:grid-cols-2">{djModes.map(dj => { const Icon = dj.icon; const selected = mode === dj.name; const favorite = favoriteDjs.includes(dj.name); const previewing = previewingMode === dj.name; return <div key={dj.name} className={cn("rounded-2xl border p-3 transition", selected ? "border-rose-200/80 bg-white/10 shadow-lg shadow-violet-950/30" : "border-white/10 bg-white/[0.025] hover:border-white/30")}><button type="button" onClick={() => setMode(dj.name)} className="w-full text-left"><span className="mb-2 flex items-start justify-between"><span className={cn("grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br text-slate-950", dj.accent)}><Icon className="h-3.5 w-3.5" /></span><span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] text-slate-400">{dj.voiceName}</span></span><span className="block text-sm font-semibold text-white">{dj.name}</span><span className="mt-1 block text-[11px] leading-4 text-slate-400">{dj.description}</span><span className="mt-2 block font-mono text-[9px] tracking-wide text-rose-200/80">{dj.voiceProfile}</span></button><div className="mt-3 grid grid-cols-[1fr_auto] gap-2"><button type="button" onClick={() => playVoicePreview(dj)} className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-cyan-200/20 bg-cyan-200/[0.06] text-[10px] font-semibold text-cyan-100">{previewing ? <Square className="h-3 w-3 fill-current" /> : <Volume2 className="h-3 w-3" />}{previewing ? "미리듣기 중지" : "목소리 미리듣기"}</button><button type="button" onClick={() => toggleFavoriteDj(dj.name)} aria-label={`${dj.name} 즐겨찾기`} className={cn("grid h-8 w-8 place-items-center rounded-lg border", favorite ? "border-amber-200/60 bg-amber-200/15 text-amber-200" : "border-white/10 text-slate-400")}><Star className={cn("h-3.5 w-3.5", favorite && "fill-current")} /></button></div></div>; })}</div></fieldset>
            <div><div className="mb-3 flex items-center justify-between"><label htmlFor="story" className="text-sm font-semibold text-slate-200">4. 한 줄 사연</label><span className={cn("font-mono text-[11px]", story.length > 108 ? "text-rose-200" : "text-slate-500")}>{story.length} / 120</span></div><Textarea id="story" value={story} maxLength={120} onChange={event => { setStory(event.target.value); setStoryError(""); }} placeholder="예: 내일 할 일은 많은데 침대에서 못 나가겠어." className="min-h-24 resize-none rounded-2xl border-white/10 bg-slate-950/40 p-4 text-sm leading-6 text-slate-100 placeholder:text-slate-600" />{storyError && <p role="alert" className="mt-2 text-xs text-rose-200">{storyError}</p>}</div>
            <Button type="submit" disabled={generateMutation.isPending} className="mt-5 h-12 w-full rounded-2xl bg-rose-300 text-sm font-bold text-slate-950 shadow-lg shadow-rose-950/40 hover:bg-rose-200">{generateMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 주파수를 맞추는 중…</> : <><Play className="mr-2 h-4 w-4 fill-current" /> 방송 시작하기</>}</Button>
          </form>

          <section ref={resultRef} aria-live="polite" className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#151126] p-5 shadow-2xl shadow-black/30 sm:p-7"><div className="pointer-events-none absolute -right-10 -top-14 h-48 w-48 rounded-full bg-fuchsia-500/15 blur-3xl" /><div className="relative flex items-center justify-between border-b border-white/10 pb-4"><div className="flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-rose-200"><span className="h-2 w-2 animate-pulse rounded-full bg-rose-300" /> ON AIR</div><span className="font-mono text-[11px] text-slate-500">{episode ? getNowLabel(episode.createdAt) : "--:--"} · ROOM 98.6 FM</span></div>{generateMutation.isPending ? <div className="flex min-h-[540px] flex-col items-center justify-center text-center"><div className="mb-6 grid h-16 w-16 place-items-center rounded-full border border-rose-200/30 bg-rose-300/10"><Loader2 className="h-7 w-7 animate-spin text-rose-200" /></div><p className="font-[Gowun_Batang] text-xl font-bold text-white">DJ가 대본을 넘겨보고 있어요</p><p className="mt-2 max-w-xs text-sm leading-6 text-slate-400">당신의 방에 맞는 오늘 밤의 주파수를 고르는 중입니다.</p></div> : episode ? <div className="relative py-8 sm:px-4"><Waveform /><div className="mt-5 text-center"><p className="mb-3 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[10px] tracking-wider text-slate-400">{episode.mode} DJ</p><h2 className="font-[Gowun_Batang] text-3xl font-bold leading-snug text-white sm:text-4xl">{episode.title}</h2><div className="mt-4 flex items-center justify-center gap-3 text-xs text-slate-500"><span>{episode.mood}</span><span className="h-1 w-1 rounded-full bg-slate-600" /><EnergyDots value={episode.energy} /></div></div><div className="mt-8 space-y-5"><article className="rounded-2xl border border-rose-200/15 bg-rose-200/[0.045] p-4 sm:p-5"><p className="mb-2 font-mono text-[10px] tracking-[0.16em] text-rose-200">DJ OPENING</p><p className="font-[Gowun_Batang] text-[17px] leading-8 text-slate-100">{episode.opening}</p></article><article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:p-5"><p className="mb-2 font-mono text-[10px] tracking-[0.16em] text-cyan-200">YOUR NIGHT STORY</p><p className="text-sm leading-7 text-slate-300">{episode.body}</p></article><article className="border-l-2 border-rose-300 pl-4 py-1"><p className="mb-1 font-mono text-[10px] tracking-[0.16em] text-rose-200">LAST WORD</p><p className="font-[Gowun_Batang] text-lg leading-8 text-white">{episode.closing}</p></article></div><audio ref={audioRef} src={audioUrl ?? undefined} preload="metadata" onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} onEnded={() => setIsPlaying(false)} onError={() => toast.error("AI DJ 오디오를 불러오지 못했습니다.")} /><div className="mt-8 grid gap-2 sm:grid-cols-4"><Button type="button" onClick={toggleAudio} disabled={synthesizeMutation.isPending} className="h-11 rounded-xl bg-rose-300 text-slate-950 hover:bg-rose-200">{synthesizeMutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 준비 중</> : isPlaying ? <><Square className="mr-2 h-4 w-4 fill-current" /> 멈추기</> : <><Play className="mr-2 h-4 w-4 fill-current" /> 방송 재생</>}</Button><Button type="button" onClick={saveEpisode} disabled={isSaved} className="h-11 rounded-xl bg-white text-slate-950 hover:bg-rose-100"><Archive className="mr-2 h-4 w-4" />{isSaved ? "저장됨" : "보관"}</Button><Button type="button" variant="outline" onClick={() => toggleFavoriteEpisode(episode)} className={cn("h-11 rounded-xl border-white/15 bg-white/[0.03]", isFavoriteEpisode ? "border-amber-200/50 text-amber-200" : "text-slate-200")}><Star className={cn("mr-2 h-4 w-4", isFavoriteEpisode && "fill-current")} />즐겨찾기</Button><Button type="button" variant="outline" onClick={() => requestGeneration(mode)} className="h-11 rounded-xl border-white/15 bg-white/[0.03] text-slate-200"><RotateCcw className="mr-2 h-4 w-4" /> 다시 만들기</Button></div><p className="mt-3 text-center text-[11px] text-slate-500">{episode.mode} DJ · {backgroundTracks[mood].label} BGM. AI 음성은 자동으로 재생됩니다.</p></div> : <div className="flex min-h-[540px] flex-col items-center justify-center text-center"><div className="mb-6 grid h-16 w-16 place-items-center rounded-full border border-white/10 bg-white/[0.04]"><Waves className="h-7 w-7 text-slate-500" /></div><p className="font-[Gowun_Batang] text-xl font-bold text-white">아직 들어온 사연이 없습니다</p><p className="mt-2 max-w-xs text-sm leading-6 text-slate-400">왼쪽 스튜디오에서 오늘의 한 줄을 보내면, DJ가 당신만의 방송을 시작합니다.</p></div>}</section>
        </section>

        <section id="favorites" className="mt-8 rounded-[2rem] border border-amber-200/15 bg-[#171426]/75 p-5 sm:mt-10 sm:p-7"><div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="font-mono text-[11px] tracking-[0.18em] text-amber-200">YOUR FAVOURITES</p><h2 className="mt-1 font-[Gowun_Batang] text-2xl font-bold text-white">다시 듣고 싶은 목소리</h2></div><p className="text-xs text-slate-500">즐겨찾기는 이 기기에 저장됩니다.</p></div>{favoriteDjs.length === 0 && favoriteEpisodes.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.025] px-5 py-10 text-center"><Star className="mx-auto h-7 w-7 text-slate-600" /><p className="mt-3 font-[Gowun_Batang] text-lg font-bold text-slate-200">아직 즐겨찾기가 없습니다</p><p className="mt-2 text-sm text-slate-500">마음에 드는 DJ나 방송에 별표를 남겨 보세요.</p></div> : <div className="grid gap-5 lg:grid-cols-2"><div><p className="mb-3 text-xs font-semibold text-slate-400">즐겨찾는 DJ</p><div className="grid gap-2 sm:grid-cols-2">{favoriteDjs.map(djMode => { const dj = djModes.find(item => item.name === djMode)!; return <div key={djMode} className="rounded-xl border border-white/10 bg-white/[0.03] p-3"><p className="text-sm font-semibold text-white">{dj.name}</p><p className="mt-1 text-[11px] text-slate-400">{dj.voiceName} · {dj.voiceProfile}</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => playVoicePreview(dj)} className="rounded-lg bg-cyan-200/10 px-2.5 py-1.5 text-[10px] text-cyan-100">미리듣기</button><button type="button" onClick={() => toggleFavoriteDj(djMode)} className="rounded-lg bg-white/5 px-2.5 py-1.5 text-[10px] text-slate-400">삭제</button></div></div>; })}</div></div><div><p className="mb-3 text-xs font-semibold text-slate-400">즐겨찾는 방송</p><div className="space-y-2">{favoriteEpisodes.map(item => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3"><button type="button" onClick={() => replayFavorite(item)} className="min-w-0 text-left"><p className="truncate font-[Gowun_Batang] text-base font-bold text-white">{item.title}</p><p className="mt-1 text-[11px] text-slate-400">{item.mode} · {getDateLabel(item.createdAt)}</p></button><button type="button" onClick={() => toggleFavoriteEpisode(item)} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-amber-200"><Star className="h-4 w-4 fill-current" /></button></div>)}</div></div></div>}</section>

        <section id="archive" className="mt-8 rounded-[2rem] border border-white/10 bg-[#0d1428]/85 p-5 sm:mt-10 sm:p-7"><div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="font-mono text-[11px] tracking-[0.18em] text-cyan-200">LATE-NIGHT ARCHIVE</p><h2 className="mt-1 font-[Gowun_Batang] text-2xl font-bold text-white">지난 방송 보관함</h2></div><p className="text-xs text-slate-500">최대 20개의 방송을 이 기기에 보관합니다.</p></div>{archive.length === 0 ? <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.025] px-5 py-12 text-center"><Archive className="mx-auto h-7 w-7 text-slate-600" /><p className="mt-4 font-[Gowun_Batang] text-lg font-bold text-slate-200">아직 보관된 방송이 없습니다</p><p className="mt-2 text-sm text-slate-500">마음에 남은 첫 번째 방송을 이곳에 넣어 보세요.</p></div> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{archive.map(item => <button key={item.id} type="button" onClick={() => setSelectedEpisode(item)} className="group rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-left transition hover:-translate-y-0.5 hover:border-rose-200/35 hover:bg-white/[0.06]"><div className="mb-4 flex items-center justify-between gap-2"><span className="rounded-full bg-white/8 px-2 py-1 text-[10px] text-rose-200">{item.mode}</span><span className="font-mono text-[10px] text-slate-500">{getDateLabel(item.createdAt)}</span></div><p className="font-[Gowun_Batang] text-lg font-bold text-white">{item.title}</p><p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{item.opening}</p><span className="mt-4 inline-flex items-center gap-1 text-xs text-slate-300 group-hover:text-rose-200">방송 전문 보기 <ChevronRight className="h-3.5 w-3.5" /></span></button>)}</div>}</section>
      </main>

      <Dialog open={Boolean(selectedEpisode)} onOpenChange={open => !open && setSelectedEpisode(null)}><DialogContent className="max-h-[88vh] overflow-y-auto border-white/10 bg-[#11182e] text-slate-100 sm:max-w-xl">{selectedEpisode && <><DialogHeader><DialogTitle className="font-[Gowun_Batang] text-2xl text-white">{selectedEpisode.title}</DialogTitle><DialogDescription className="text-slate-400">{getDateLabel(selectedEpisode.createdAt)} · {selectedEpisode.mode} · 에너지 {selectedEpisode.energy}/5</DialogDescription></DialogHeader><div className="mt-4 space-y-4 text-sm leading-7 text-slate-300"><p className="rounded-xl border border-rose-200/15 bg-rose-200/[0.045] p-4 text-slate-100">{selectedEpisode.opening}</p><p>{selectedEpisode.body}</p><p className="border-l-2 border-rose-300 pl-4 font-[Gowun_Batang] text-base text-white">{selectedEpisode.closing}</p><p className="rounded-xl bg-white/[0.04] p-3 text-xs text-slate-400">청취자 사연: {selectedEpisode.story}</p></div><Button type="button" variant="outline" onClick={() => removeEpisode(selectedEpisode.id)} className="mt-6 w-full border-rose-300/30 bg-rose-300/5 text-rose-100 hover:bg-rose-300/15 hover:text-rose-50"><Trash2 className="mr-2 h-4 w-4" /> 이 방송 삭제하기</Button></>}</DialogContent></Dialog>
      <style>{`@keyframes radioEqualize { from { transform: scaleY(.3); } to { transform: scaleY(1.35); } } .radio-wave { animation: radioEqualize 760ms ease-in-out infinite alternate; transform-origin: center; } @media (prefers-reduced-motion: reduce) { .radio-wave { animation: none; } }`}</style>
    </div>
  );
}
