import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// High limits for handling high-resolution image uploads
app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

// Initialize GoogleGenAI server-side client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface ImagePayload {
  data: string; // base64 string without data:mime;base64, prefix
  mimeType: string;
}

interface EditRequest {
  images: ImagePayload[];
  prompt: string;
  preferredModel?: string;
}

// Fallback sequence for image editing
const MODEL_FALLBACKS = [
  'gemini-2.5-flash-image',
  'gemini-3.1-flash-lite-image',
  'gemini-nano-banana-2.1',
  'gemini-3-pro-image',
];

app.post('/api/edit-photo', async (req, res) => {
  const { images, prompt, preferredModel } = req.body as EditRequest;

  if (!images || !Array.isArray(images) || images.length === 0) {
    res.status(400).json({ error: 'No images provided for editing.' });
    return;
  }

  if (!prompt || typeof prompt !== 'string') {
    res.status(400).json({ error: 'No prompt provided.' });
    return;
  }

  // Construct models to try: preferred first, then remaining fallbacks
  const primaryModel = preferredModel || 'gemini-2.5-flash-image';
  const modelsToTry = [
    primaryModel,
    ...MODEL_FALLBACKS.filter((m) => m !== primaryModel),
  ];

  const errors: { model: string; error: string; status?: number }[] = [];

  // Build the contents parts
  const parts: any[] = [];
  for (const img of images) {
    // Strip header if present
    const cleanData = img.data.replace(/^data:[^;]+;base64,/, '');
    parts.push({
      inlineData: {
        data: cleanData,
        mimeType: img.mimeType || 'image/png',
      },
    });
  }
  parts.push({ text: prompt });

  for (const model of modelsToTry) {
    try {
      console.log(`[Lumina AI] Calling image model: ${model}`);
      const response = await ai.models.generateContent({
        model,
        contents: { parts },
      });

      // Find image part in candidates
      let foundImageBase64: string | null = null;
      let foundMimeType = 'image/png';
      let textFeedback: string | null = null;

      const candidates = response.candidates ?? [];
      for (const candidate of candidates) {
        for (const part of candidate.content?.parts ?? []) {
          if (part.inlineData?.data) {
            foundImageBase64 = part.inlineData.data;
            if (part.inlineData.mimeType) {
              foundMimeType = part.inlineData.mimeType;
            }
            break;
          } else if (part.text) {
            textFeedback = (textFeedback ? textFeedback + '\n' : '') + part.text;
          }
        }
        if (foundImageBase64) break;
      }

      if (foundImageBase64) {
        console.log(`[Lumina AI] Successfully generated output using ${model}`);
        res.json({
          success: true,
          modelUsed: model,
          mimeType: foundMimeType,
          imageData: foundImageBase64,
          textFeedback,
        });
        return;
      } else {
        console.warn(`[Lumina AI] Model ${model} returned text but no image.`);
        errors.push({
          model,
          error: textFeedback || 'Model responded without an image candidate.',
        });
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const isQuotaErr = errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota') || errMsg.includes('429');
      const status = err?.status || (errMsg.includes('403') ? 403 : errMsg.includes('404') ? 404 : isQuotaErr ? 429 : 500);

      console.warn(`[Lumina AI] Model ${model} returned status ${status} (${isQuotaErr ? 'Quota limit: 0 on Free Tier' : errMsg.slice(0, 100)})`);

      let userExplanation = errMsg;
      if (status === 403 || errMsg.includes('PERMISSION_DENIED') || errMsg.includes('API_KEY_INVALID')) {
        userExplanation = 'Permission Denied (403): The current API key lacks permission for this model. Please check the API key in Settings > Secrets.';
      } else if (status === 404 || errMsg.includes('NOT_FOUND')) {
        userExplanation = `Model Not Found (404): Model '${model}' was not found. Attempting alternative models...`;
      } else if (isQuotaErr) {
        userExplanation = 'Quota Exceeded (429): Free Tier quota limit reached (limit: 0 for image models). You can attach a billing-enabled key in Settings > Secrets.';
      }

      errors.push({
        model,
        error: userExplanation,
        status: status || 429,
      });
      // Continue to next fallback model
    }
  }

  // All models failed
  const isQuota = errors.some((e) => e.status === 429 || e.error.includes('Quota'));
  const primaryError = errors[0];

  // Return status 200 with isQuotaError=true so the client can seamlessly use Studio Engine without throwing an HTTP exception
  if (isQuota) {
    res.status(200).json({
      success: false,
      isQuotaError: true,
      error: 'Quota Exceeded',
      message: 'Free Tier quota reached (limit: 0 for image models). Studio High-Precision Engine active.',
      details: errors,
    });
    return;
  }

  res.status(primaryError?.status || 500).json({
    error: 'All image editing models failed.',
    isQuotaError: false,
    details: errors,
    message: errors.map((e) => `[${e.model}]: ${e.error}`).join('\n'),
  });
});

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Lumina Studio server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
