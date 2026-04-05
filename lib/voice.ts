// lib/voice.ts
// 100% free — uses browser built-in Speech APIs
// No API keys needed

// ── SPEECH TO TEXT (Microphone → Text) ────────────────────────────────────────
export function startVoiceInput(
  onResult: (text: string) => void,
  onError?: (err: string) => void
): () => void {
  const SR =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;

  if (!SR) {
    onError?.("Voice not supported. Please use Chrome or Edge.");
    return () => {};
  }

  const recognition = new SR();
  recognition.lang = "ur-PK"; // Urdu primary — also understands English
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (e: any) => {
    const transcript = e.results[0][0].transcript;
    onResult(transcript);
  };

  recognition.onerror = (e: any) => {
    onError?.(e.error);
  };

  recognition.start();

  // Return stop function
  return () => {
    try { recognition.stop(); } catch {}
  };
}

// ── TEXT TO SPEECH (Text → Voice) ─────────────────────────────────────────────
export function speak(text: string): void {
  if (typeof window === "undefined") return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  // Try to find an Urdu voice
  const voices = window.speechSynthesis.getVoices();
  const urduVoice =
    voices.find((v) => v.lang === "ur-PK") ||
    voices.find((v) => v.lang.startsWith("ur"));

  if (urduVoice) utterance.voice = urduVoice;

  utterance.rate = 0.92;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

// ── LANGUAGE DETECTION ────────────────────────────────────────────────────────
export function detectLang(text: string): "ur" | "en" {
  if (/[\u0600-\u06FF]/.test(text)) return "ur";
  const romanUrdu =
    /\b(kya|hai|hain|mujhe|aap|batao|dikhao|karo|tha|thi|nahi|nahin|bhi|lekin|yeh|woh|toh|kuch|sab|mere|tumhara|hoga|hogay)\b/i;
  return romanUrdu.test(text) ? "ur" : "en";
}