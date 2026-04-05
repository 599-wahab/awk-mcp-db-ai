// app/api/voice/stt/route.ts
// OpenAI Whisper speech-to-text — handles Urdu, Roman Urdu, English

export async function POST(req: Request) {
  const formData = await req.formData();
  const audio = formData.get("audio") as Blob;

  if (!audio) {
    return Response.json({ error: "No audio provided" }, { status: 400 });
  }

  // Forward to OpenAI Whisper
  const whisperForm = new FormData();
  whisperForm.append("file", audio, "recording.webm");
  whisperForm.append("model", "whisper-1");
  // "ur" hints Whisper toward Urdu — it still handles English fine
  // Set to null to let Whisper auto-detect if you prefer
  whisperForm.append("language", "ur");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: whisperForm,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Whisper error:", err);
    return Response.json({ error: "Transcription failed" }, { status: 500 });
  }

  const data = await res.json();
  return Response.json({ text: data.text });
}