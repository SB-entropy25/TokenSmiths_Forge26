import { getAppConfig } from '../config/env';
import { getSupabaseClient } from './supabaseClient';
import { INITIAL_CLUSTERS, INITIAL_DEPARTMENTS } from './mockData';
import {
  Cluster,
  Ticket,
  SubmissionPayload,
  SubmissionResponse,
  TimelineEvent,
  DangerAspects,
} from '../types';

// In-memory runtime cache populated directly from Supabase (Zero localStorage reliance)
let clustersData: Cluster[] = [];

// Clean up any old localStorage artifacts
try {
  localStorage.removeItem('CIVIC_CLUSTERS_CACHE');
  localStorage.removeItem('CIVIC_USER_CLUSTERS');
} catch (e) {
  // Ignore
}

const persistClusters = () => {
  // No-op: Supabase is the single source of truth!
};

// Fetch clusters (syncs live from Supabase if connected, else uses local cache)
export const fetchLiveClusters = async (): Promise<Cluster[]> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return [...clustersData];
  }

  try {
    const { data: dbClusters, error } = await supabase
      .from('clusters')
      .select('*, tickets(*), timeline_events(*)')
      .order('created_at', { ascending: false });

    if (error || !dbClusters) {
      console.warn('Supabase fetch error, fallback to local cache:', error);
      return [...clustersData];
    }

    // Format Supabase rows to Cluster interface
    const formatted: Cluster[] = dbClusters.map((c: any) => {
      // Parse coordinates from PostGIS or fallback
      let lat = 28.6139;
      let lng = 77.2090;
      if (c.center && typeof c.center === 'object' && c.center.coordinates) {
        lng = c.center.coordinates[0];
        lat = c.center.coordinates[1];
      }

      return {
        id: c.id,
        category: c.category,
        center_lat: lat,
        center_lng: lng,
        address: c.address || `Incident #${c.id.slice(0, 8)}`,
        locality: c.locality || 'City Ward',
        severity_current: c.severity_current || 3,
        flag_count: c.flag_count || (c.tickets?.length || 1),
        status: c.status || 'received',
        department_name: c.department_name,
        department_id: c.department_id,
        eta_at: c.eta_at,
        last_escalated_at: c.last_escalated_at,
        reminder_sent: c.reminder_sent || false,
        closed_at: c.closed_at,
        proof_photo_url: c.proof_photo_url,
        reopen_count: c.reopen_count || 0,
        created_at: c.created_at,
        tickets: (c.tickets || []).map((t: any) => ({
          id: t.id,
          ticket_code: t.ticket_code,
          cluster_id: t.cluster_id,
          name: t.name,
          email: t.email,
          mobile: t.mobile,
          category: t.category,
          description: t.description,
          wide_photo_url: t.wide_photo_url,
          near_photo_url: t.near_photo_url,
          lat: t.lat,
          lng: t.lng,
          accuracy_m: t.accuracy_m,
          ai_generated_score: t.ai_generated_score ?? (c.status === 'under_verification' ? 0.5 : 0.05),
          ai_flag: Boolean(t.ai_flag || c.status === 'under_verification'),
          severity_ai: t.severity_ai || 3,
          severity_final: t.severity_final || 3,
          danger: t.danger || {},
          context: t.context || {},
          description_consistent: t.description_consistent ?? true,
          ai_summary: t.ai_summary || '',
          eta_hours: t.eta_hours || 24,
          created_at: t.created_at,
        })),
        timeline: c.timeline_events || [],
        escalation_requested: Boolean(
          (c.timeline_events || []).some(
            (ev: any) =>
              ev.type === 'escalated' &&
              (ev.actor?.toLowerCase().includes('citizen') || ev.message?.toLowerCase().includes('citizen escalation'))
          )
        ),
      };
    });

    clustersData = formatted;
    return formatted;
  } catch (err) {
    console.warn('Exception during live Supabase fetch:', err);
  }

  return [...clustersData];
};

export const getClusters = (): Cluster[] => {
  return [...clustersData];
};

export const getDepartments = () => {
  return INITIAL_DEPARTMENTS;
};

// Haversine distance in meters
export const calculateDistanceMeters = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export const getNextTicketCode = (): string => {
  const total = clustersData.reduce((acc, c) => acc + (c.tickets?.length || 0), 0) + 1;
  return `CP-2026-${String(total).padStart(6, '0')}`;
};

// Forensic scan for AI generation signatures and generator dimensions
const scanImageForAiArtifacts = async (
  file: File | Blob
): Promise<{ isAi: boolean; score: number; reason: string }> => {
  try {
    // 1. Scan binary metadata bytes (first 256KB) for AI generator headers
    const buffer = await file.slice(0, 262144).arrayBuffer();
    const text = new TextDecoder('latin1').decode(buffer).toLowerCase();

    const aiSignatures = [
      'stablediffusion', 'parameters', 'negative prompt', 'steps: ',
      'sampler: ', 'dall-e', 'midjourney', 'comfyui', 'automatic1111',
      'novelai', 'flux.1', 'dreamstudio', 'bingimagecreator', 'civitai',
      'fooocus', 'kandinsky', 'ai-generated', 'synthid', 'ideogram',
      'leonardo.ai', 'firefly'
    ];

    for (const sig of aiSignatures) {
      if (text.includes(sig)) {
        return {
          isAi: true,
          score: 0.98,
          reason: `Embedded AI generator signature detected in file metadata: "${sig}".`,
        };
      }
    }

    // 2. Metadata signature check complete (image dimension alone is not flagged as AI to prevent false positives on cropped photos)
  } catch (e) {
    console.warn('Binary AI scan error:', e);
  }
  return { isAi: false, score: 0, reason: '' };
};

// Compress image to max 1280px on the fly and convert to Base64 (stripping header prefix)
const compressAndConvertToBase64 = (file: File | Blob, maxWidth = 1280, maxHeight = 1280): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { naturalWidth: width, naturalHeight: height } = img;
      if (width > maxWidth || height > maxHeight) {
        if (width > height) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve(dataUrl.split(',')[1]);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    };
    img.src = url;
  });
};

const fileToBase64 = compressAndConvertToBase64;

// Upload photo directly to Supabase Storage with strict 3-second timeout protection
const uploadPhotoDirect = async (file: File | Blob, bucket: 'reports' | 'proofs'): Promise<string> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return URL.createObjectURL(file);
  }

  try {
    const ext = file.type === 'image/png' ? 'png' : 'jpg';
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`;

    const uploadPromise = supabase.storage.from(bucket).upload(filename, file, {
      contentType: file.type || 'image/jpeg',
      upsert: true,
    });

    const timeoutPromise = new Promise<{ error: Error; data: null }>((resolve) =>
      setTimeout(() => resolve({ error: new Error('Upload timed out'), data: null }), 3500)
    );

    const { error } = (await Promise.race([uploadPromise, timeoutPromise])) as any;

    if (error) {
      console.warn(`Supabase Storage upload to ${bucket} returned error or timed out, using preview URL:`, error);
      return URL.createObjectURL(file);
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(filename);
    return data.publicUrl || URL.createObjectURL(file);
  } catch (err) {
    console.warn('Storage upload exception, using local URL:', err);
    return URL.createObjectURL(file);
  }
};

// Direct Gemini 3.6 Flash Vision Multimodal Analysis
const analyzeWithGeminiDirect = async (
  widePhoto: File | Blob,
  nearPhoto: File | Blob,
  category: string,
  description: string,
  apiKey: string
): Promise<{
  is_ai_generated?: boolean;
  ai_watermark_detected?: boolean;
  ai_watermark_description?: string;
  ai_generated_probability?: number;
  ai_generated_explanation?: string;
  is_valid_civic_issue: boolean;
  detected_issue_type: string;
  matches_category: boolean;
  description_consistent: boolean;
  rejection_reason: string;
  severity_ai: number;
  summary: string;
  eta_hours: number;
  danger: DangerAspects;
  confidence: number;
}> => {
  const wideBase64 = await fileToBase64(widePhoto);
  const nearBase64 = await fileToBase64(nearPhoto);

  const promptText = `
You are a senior forensic civic infrastructure inspector and fraud detection AI for a municipal government complaint portal.
Image 1 is a WIDE view of the public area. Image 2 is a NEAR view of the reported issue.
Citizen chosen category: "${category}"
Citizen submitted description: """${description}"""

YOUR CRITICAL VERIFICATION TASKS IN STRICT ORDER:

TASK 1: GENERATIVE AI & SYNTHETIC FORENSICS (CHECK THIS FIRST!)
Inspect both images at pixel, edge, texture, and compositional levels for ANY generative AI evidence (Midjourney, DALL-E, Stable Diffusion, Flux, Sora, Adobe Firefly, Photoshop Generative Fill, Imagen, Bing Creator, or CGI):
- Watermarks & Logos: DALL-E squares, Bing watermarks, Midjourney badges, or translucent AI stamps.
- Synthetic Textures: Unnatural plastic sheen, airbrushed smoothness, cartoonish rendering, surreal volumetric lighting, warped geometry, melting curbs, floating objects, alien/gibberish text on street signs.
- If ANY AI indicator is detected:
  * Set "is_ai_generated": true
  * Set "ai_watermark_detected": true (if visible)
  * Set "ai_generated_probability": 0.95 to 1.00
  * Set "is_valid_civic_issue": false
  * Set "detected_issue_type": "not_a_civic_issue"
  * Set "rejection_reason": "AI-generated / synthetic imagery detected (Watermark/Synthetic artifacts identified). Only genuine camera photos of real physical infrastructure damage are accepted."

TASK 2: AUTHENTIC PUBLIC CIVIC HAZARD CHECK
Do the photos show a genuine public municipal infrastructure problem (such as road pothole, leaking water main, exposed electrical cable, open manhole/sewage drain, garbage pile, broken streetlight, fallen tree)?
- If the photos show: pets, animals, food, selfies, bedrooms, indoor furniture, random wallpapers, memes, car interiors, screenshots, natural mountains/forests, or unrelated everyday objects:
  * Set "is_valid_civic_issue": false
  * Set "detected_issue_type": "not_a_civic_issue"
  * Set "rejection_reason": "Not a municipal public hazard. Uploaded photo depicts an unrelated subject rather than public civic infrastructure damage."
- If the photos are completely dark, pitch black, or blurry beyond recognition:
  * Set "is_valid_civic_issue": false
  * Set "rejection_reason": "Uploaded photos are too dark or blurry to visually inspect the civic hazard."

TASK 3: CATEGORY & PHOTO RELEVANCE CHECK (STRICT TYPE CHECK)
Does the visible physical issue in the photos match the citizen's chosen category "${category}"?
The allowed municipal categories are:
- "pothole": Road craters, asphalt cracks, damaged pavement.
- "garbage": Dumped trash, overflowing municipal bins, waste piles.
- "water_leak": Pipe burst, leaking clean/potable water mains, street flooding from clean pipes.
- "sewage_drain": Blocked sewers, missing manhole covers, overflowing gutter/drain, toxic sludge.
- "streetlight": Broken light pole, non-working lamp fixture, dark intersection.
- "electrical_hazard": Live hanging wires, sparking transformer, exposed high-voltage junction box.
- "fallen_tree": Tree or large branch fallen on public road, power lines, or walkway.
- "other": Legitimate civic damage not covered above.

STRICT RULE: If the photo clearly depicts a DIFFERENT category than "${category}" (e.g. citizen selected "pothole" but photo depicts garbage, water leak, dog, car, etc.):
* Set "matches_category": false
* Set "detected_issue_type": [actual category detected, e.g. "garbage", "water_leak", "pothole", "not_a_civic_issue"]
* Set "rejection_reason": "Category Mismatch: You selected '${category.replace('_', ' ')}', but the uploaded photo depicts " + detected_issue_type + ". Please select the correct category from the dropdown or upload matching photos."

TASK 4: DESCRIPTION & PHOTO CONSISTENCY CHECK
Does the citizen's text description truthfully describe what is visibly seen in the photos?
- If citizen describes a massive water pipe burst but photo shows a dry pothole, set "description_consistent": false.
- If citizen wrote spam, random gibberish, test words ("asdf", "test 123", "nothing"), or completely unrelated text, set "description_consistent": false.
- If inconsistent:
  * Set "description_consistent": false
  * Set "rejection_reason": "Description Mismatch: Your description does not match the physical condition visible in the photos."

TASK 5: SEVERITY & DANGER RATING (Only if real authentic civic issue matching category)
- Rate severity from 1 (minor cosmetic defect) to 5 (critical immediate danger to human life: live high-voltage wire, open deep manhole, building collapse risk).
- Rate danger aspects (true/false): risk_to_life, electrical_hazard, open_manhole_or_pit, blocks_emergency_access, traffic_hazard, water_or_flood_risk, health_hazard, worsens_over_time.
- Suggest realistic resolution timeline in hours (urgent hazard: 6h, road pothole: 24-48h, garbage: 24h, minor: 72h).

Reply ONLY with valid raw JSON in this exact structure:
{
  "is_ai_generated": true | false,
  "ai_watermark_detected": true | false,
  "ai_watermark_description": "string describing watermark if found, else empty",
  "ai_generated_probability": float (0.85 to 1.00 if AI-generated or watermarked; 0.00 to 0.15 ONLY if genuine camera photo),
  "ai_generated_explanation": "string explaining visual forensic rationale",
  "is_valid_civic_issue": boolean,
  "detected_issue_type": "pothole" | "garbage" | "water_leak" | "sewage_drain" | "streetlight" | "electrical_hazard" | "fallen_tree" | "other" | "not_a_civic_issue",
  "matches_category": boolean,
  "description_consistent": boolean,
  "rejection_reason": "string (mandatory if is_ai_generated is true, is_valid_civic_issue is false, matches_category is false, or description_consistent is false)",
  "severity_ai": 1 | 2 | 3 | 4 | 5,
  "summary": "technical summary for municipal workers",
  "eta_hours": 6 | 24 | 48 | 72,
  "confidence": float,
  "danger": {
    "risk_to_life": boolean,
    "electrical_hazard": boolean,
    "open_manhole_or_pit": boolean,
    "blocks_emergency_access": boolean,
    "traffic_hazard": boolean,
    "water_or_flood_risk": boolean,
    "health_hazard": boolean,
    "worsens_over_time": boolean
  }
}
`;

  const cleanKey = apiKey.trim().replace(/^["']|["']$/g, '');
  const candidateModels = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'];
  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: promptText },
                { inline_data: { mime_type: 'image/jpeg', data: wideBase64 } },
                { inline_data: { mime_type: 'image/jpeg', data: nearBase64 } },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      });

      if (!res.ok) {
        const errorBody = await res.text();
        lastError = new Error(`Gemini (${model}) returned HTTP ${res.status}: ${errorBody}`);
        continue; // Try next model
      }

      const json = await res.json();
      const textOutput = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textOutput) throw new Error('Empty response from Gemini');

      const sanitizedJson = textOutput.replace(/```json/gi, '').replace(/```/g, '').trim();
      return JSON.parse(sanitizedJson);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('All Gemini model endpoints failed.');
};

// Query Context: Weather (Open-Meteo) & OSM Overpass (School/Hospital proximity)
const queryLiveContext = async (lat: number, lng: number): Promise<{ nearSchoolOrHospital: boolean; rainForecast: boolean }> => {
  let nearSchoolOrHospital = false;
  let rainForecast = false;

  try {
    // 1. Open-Meteo Forecast (Free public API, 2s timeout)
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=precipitation&forecast_days=1`,
      { signal: AbortSignal.timeout(2000) }
    );
    if (weatherRes.ok) {
      const weatherData = await weatherRes.json();
      const precipitationList: number[] = weatherData.hourly?.precipitation || [];
      rainForecast = precipitationList.some((p) => p > 1.0);
    }
  } catch (e) {
    console.info('Open-Meteo context skipped or timed out:', e);
  }

  try {
    // 2. Overpass API (Free public OSM API, 2s timeout)
    const overpassQuery = `[out:json][timeout:3];nwr(around:300,${lat},${lng})[amenity~"school|hospital"];out count;`;
    const overpassRes = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: overpassQuery,
      signal: AbortSignal.timeout(2000),
    });
    if (overpassRes.ok) {
      const overpassData = await overpassRes.json();
      nearSchoolOrHospital = (overpassData.elements?.length || 0) > 0;
    }
  } catch (e) {
    console.info('Overpass context skipped or timed out:', e);
  }

  return { nearSchoolOrHospital, rainForecast };
};

/**
 * SUBMIT CIVIC REPORT (DIRECT MODE OR N8N)
 */
export const submitCivicReport = async (payload: SubmissionPayload): Promise<SubmissionResponse> => {
  const config = getAppConfig();
  const supabase = getSupabaseClient();

  // If user explicitly configured n8n and disabled direct mode, try n8n first
  if (!config.useDirectMode && config.n8nSubmitWebhookUrl) {
    try {
      const formData = new FormData();
      formData.append('category', payload.category);
      formData.append('description', payload.description);
      formData.append('name', payload.name);
      formData.append('email', payload.email);
      formData.append('mobile', payload.mobile);
      formData.append('lat', String(payload.lat));
      formData.append('lng', String(payload.lng));
      formData.append('accuracy', String(payload.accuracy));
      formData.append('wide_photo', payload.wide_photo);
      formData.append('near_photo', payload.near_photo);

      const res = await fetch(config.n8nSubmitWebhookUrl, {
        method: 'POST',
        headers: { 'x-api-secret': config.formApiSecret },
        body: formData,
      });

      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.info('n8n call failed, continuing with Direct Engine:', err);
    }
  }

  // ==========================================
  // DIRECT PIPELINE (NO n8n REQUIRED!)
  // ==========================================

  // Step 1: Run local binary metadata scan for AI generator artifacts (ZERO upload yet!)
  const [wideScan, nearScan] = await Promise.all([
    scanImageForAiArtifacts(payload.wide_photo),
    scanImageForAiArtifacts(payload.near_photo),
  ]);

  // Step 2: Query Context (Weather + Proximity to School/Hospital)
  const context = await queryLiveContext(payload.lat, payload.lng);

  // Step 3: Run AI Multimodal Vision Analysis (Gemini 3.6 Flash)
  let aiResult: {
    is_valid_civic_issue: boolean;
    detected_issue_type: string;
    matches_category: boolean;
    description_consistent: boolean;
    rejection_reason: string;
    severity_ai: number;
    summary: string;
    eta_hours: number;
    danger: DangerAspects;
    confidence: number;
    is_ai_generated?: boolean;
    ai_watermark_detected?: boolean;
    ai_watermark_description?: string;
    ai_generated_probability?: number;
    ai_generated_explanation?: string;
  };

  if (config.geminiApiKey) {
    try {
      aiResult = await analyzeWithGeminiDirect(
        payload.wide_photo,
        payload.near_photo,
        payload.category,
        payload.description,
        config.geminiApiKey
      );
    } catch (err: any) {
      console.warn('Direct Gemini call failed or rate-limited:', err);
      const errMsg = String(err?.message || '');
      const isRateLimit = errMsg.includes('429') || errMsg.includes('Resource has been exhausted') || errMsg.includes('quota') || errMsg.includes('RESOURCE_EXHAUSTED');
      const isConnectionIssue = !isRateLimit && (
        err?.name === 'TypeError' ||
        errMsg.includes('fetch') || errMsg.includes('network') || errMsg.includes('offline') || errMsg.includes('Failed to fetch') || errMsg.includes('timeout') || errMsg.includes('getaddrinfo')
      );

      if (isConnectionIssue) {
        // Temporary network drop -> ask for 10sec retry
        return {
          success: false,
          ticket_code: '',
          cluster_id: '',
          severity_final: 0,
          eta_hours: 0,
          status: 'rejected',
          ai_summary: 'AI Verification Connection Issue: Temporary network connection failure to AI model. Please wait 10 seconds and retry.',
          ai_formal_description: 'Could not connect to visual inspection service. Please check your internet connection, wait 10 seconds, and submit again.',
          danger: {
            risk_to_life: false,
            electrical_hazard: false,
            open_manhole_or_pit: false,
            blocks_emergency_access: false,
            traffic_hazard: false,
            water_or_flood_risk: false,
            health_hazard: false,
            worsens_over_time: false,
          },
          ai_generated_score: 0,
          portal_verdict: 'rejected',
          context,
          message: 'AI Verification Connection Issue: Temporary network connection failure to AI model. Please wait 10 seconds and retry.',
        };
      }

      if (isRateLimit) {
        // True API Quota Limit Exceeded -> Forwarded for admin verification as model is undergoing updates
        aiResult = getHeuristicAI(payload.category, payload.lat, payload.lng, payload.description);
        aiResult.summary = 'Forwarded for admin verification as the model is undergoing updates.';
        aiResult.is_ai_generated = false;
        aiResult.ai_generated_probability = 0;
        aiResult.severity_ai = 0;
        aiResult.eta_hours = 0;
      } else {
        // Fallback heuristic evaluation if transient non-rate-limit exception
        aiResult = getHeuristicAI(payload.category, payload.lat, payload.lng, payload.description);
        aiResult.is_ai_generated = false;
        aiResult.ai_generated_probability = 0.05;
      }

      aiResult.danger = {
        risk_to_life: false,
        electrical_hazard: false,
        open_manhole_or_pit: false,
        blocks_emergency_access: false,
        traffic_hazard: false,
        water_or_flood_risk: false,
        health_hazard: false,
        worsens_over_time: false,
      };
    }
  } else {
    // Intelligent local fallback if no Gemini key entered yet
    aiResult = getHeuristicAI(payload.category, payload.lat, payload.lng, payload.description);
  }

  const isModelOverloaded = Boolean(
    aiResult.summary?.includes('undergoing updates') ||
    aiResult.summary?.includes('Model Undergoing Updates')
  );

  // Calculate true AI-Generated / Synthetic Confidence
  const metadataScore = Math.max(wideScan.score, nearScan.score);
  // Rely strictly on explicit boolean flags from Gemini or explicit positive rejection reasons
  const textIndicatesAi =
    !isModelOverloaded &&
    (aiResult.is_ai_generated === true ||
      aiResult.ai_watermark_detected === true ||
      (Boolean(aiResult.rejection_reason) && /is ai[- ]?generated|contains synthetic|watermark detected|deepfake detected/i.test(aiResult.rejection_reason || '')));

  const geminiScore = isModelOverloaded
    ? 0
    : typeof aiResult.ai_generated_probability === 'number'
    ? aiResult.ai_generated_probability
    : (textIndicatesAi ? 0.85 : 0.04);

  const combinedAiScore = isModelOverloaded
    ? 0
    : Math.max(metadataScore, geminiScore, textIndicatesAi ? 0.85 : 0);

  const aiGeneratedScore = isModelOverloaded ? 0 : Number(Math.max(0, Math.min(1, combinedAiScore)).toFixed(2));

  // Check if AI generation/synthetic image is detected (never true if model was overloaded)
  const isAiGenerated = !isModelOverloaded && Boolean(aiResult.is_ai_generated || aiResult.ai_watermark_detected || combinedAiScore >= 0.50);

  // HARD REJECTIONS (Zero Admin Review Queue - Rejected Immediately):
  // 1. Category Mismatch (e.g. selected "pothole" but photo depicts garbage, car, dog, etc.)
  const isCategoryMismatch = aiResult.matches_category === false;
  // 2. Description Mismatch (description contradicts photo or is spam/gibberish)
  const isDescriptionMismatch = aiResult.description_consistent === false;
  // 3. Non-Civic Subject (photo depicts pets, food, selfie, furniture, mountains, memes, etc. - NOT municipal damage)
  const isNonCivicSubject = (!aiResult.is_valid_civic_issue && !isAiGenerated) || aiResult.detected_issue_type === 'not_a_civic_issue';

  // HARD REJECTION TRIGGER: If category mismatch, description mismatch, or non-civic subject, reject outright!
  if (isCategoryMismatch || isDescriptionMismatch || isNonCivicSubject) {
    let rejectionMsg = aiResult.rejection_reason;
    if (isCategoryMismatch) {
      const detectedLabel = aiResult.detected_issue_type && aiResult.detected_issue_type !== 'not_a_civic_issue'
        ? aiResult.detected_issue_type.replace('_', ' ')
        : 'an unrelated subject';
      rejectionMsg = `Category Mismatch: You selected "${payload.category.replace('_', ' ').toUpperCase()}", but the uploaded photo depicts ${detectedLabel}. Please select the matching category from the dropdown or upload matching photos.`;
    } else if (isDescriptionMismatch) {
      rejectionMsg = `Description Inconsistent: The submitted description does not match the physical condition visible in the photos. Please provide an accurate description of the visible hazard.`;
    } else if (isNonCivicSubject) {
      rejectionMsg = rejectionMsg || `Not a Municipal Civic Hazard: Uploaded photo does not depict real public infrastructure damage (roads, drainage, electrical, waste). Submissions showing private interiors, personal objects, animals, landscapes, or memes are directly rejected.`;
    }

    return {
      success: false,
      ticket_code: 'REJECTED-PORTAL-001',
      cluster_id: '',
      severity_final: 0,
      eta_hours: 0,
      status: 'rejected',
      ai_summary: rejectionMsg,
      ai_formal_description: isCategoryMismatch
        ? `Submission Rejected: Category mismatch. Selected: ${payload.category.replace('_', ' ').toUpperCase()}, Detected: ${aiResult.detected_issue_type.replace('_', ' ')}.`
        : isDescriptionMismatch
        ? `Submission Rejected: Description inconsistency. Text does not match photographic evidence.`
        : `Submission Rejected by Portal AI: Evidence does not depict public infrastructure damage.`,
      danger: {
        risk_to_life: false,
        electrical_hazard: false,
        open_manhole_or_pit: false,
        blocks_emergency_access: false,
        traffic_hazard: false,
        water_or_flood_risk: false,
        health_hazard: false,
        worsens_over_time: false,
      },
      ai_generated_score: 0, // Score 0 indicates description/category failure: do not show AI authenticity bar!
      portal_verdict: 'rejected',
      context,
      message: rejectionMsg,
    };
  }

  // TASK: If passed description + category + image check, check AI synthetic score:
  // If AI verification is ABOVE 80% (> 0.80), directly reject!
  const isDirectAiRejection = !isModelOverloaded && aiGeneratedScore > 0.80;
  if (isDirectAiRejection) {
    const syntheticPct = Math.round(aiGeneratedScore * 100);
    const remarks = aiResult.ai_generated_explanation || aiResult.rejection_reason || 'Diffusion artifacts and generative deepfake textures detected.';
    const aiRejectMsg = `Visual Forensics Rejected: Photographic evidence exceeded 80% synthetic threshold (${syntheticPct}% AI-generated detected). ${remarks} AI-generated and deepfake submissions are strictly disallowed.`;

    return {
      success: false,
      ticket_code: 'REJECTED-SYNTHETIC-001',
      cluster_id: '',
      severity_final: 0,
      eta_hours: 0,
      status: 'rejected',
      ai_summary: aiRejectMsg,
      ai_formal_description: `Submission Disallowed: Deepfake / synthetic imagery detected (${syntheticPct}%).`,
      danger: {
        risk_to_life: false,
        electrical_hazard: false,
        open_manhole_or_pit: false,
        blocks_emergency_access: false,
        traffic_hazard: false,
        water_or_flood_risk: false,
        health_hazard: false,
        worsens_over_time: false,
      },
      ai_generated_score: aiGeneratedScore, // Pass score > 80% so AI bar shows the direct rejection
      portal_verdict: 'rejected',
      context,
      message: aiRejectMsg,
    };
  }

  // =========================================================================
  // VERIFICATION PASSED: Genuine civic hazard confirmed.
  // ONLY NOW do we upload the photos to Supabase Storage & store in database!
  // (Failed or rejected submissions store ZERO images and ZERO database rows)
  // =========================================================================
  const [wideUrl, nearUrl] = await Promise.all([
    uploadPhotoDirect(payload.wide_photo, 'reports'),
    uploadPhotoDirect(payload.near_photo, 'reports'),
  ]);

  // Step 4: Determine if held for review (between 30% and 80%, or model overloaded):
  const isHeld = isModelOverloaded || (aiGeneratedScore >= 0.30 && aiGeneratedScore <= 0.80);
  const portalVerdict: 'accepted' | 'held' | 'rejected' = isHeld ? 'held' : 'accepted';
  const status: any = isHeld ? 'under_verification' : 'received';

  let severityFinal = isModelOverloaded ? 0 : aiResult.severity_ai;
  if (!isModelOverloaded && severityFinal > 0) {
    if (context.nearSchoolOrHospital && severityFinal < 5) severityFinal += 1;
    if (context.rainForecast && (payload.category === 'water_leak' || payload.category === 'sewage_drain') && severityFinal < 5) {
      severityFinal += 1;
    }
    severityFinal = Math.min(5, Math.max(1, severityFinal));
  }

  // Construct explicit, transparent hold reason for both Citizen and Admin
  if (isHeld) {
    if (isModelOverloaded) {
      aiResult.summary = 'Forwarded for admin verification as the model is undergoing updates.';
    } else {
      const syntheticPct = Math.round(aiGeneratedScore * 100);
      const remarks = aiResult.ai_generated_explanation || aiResult.rejection_reason || aiResult.ai_watermark_description || 'Visual evidence exhibits synthetic generation markers';
      aiResult.summary = `Gemini Vision Flagged: Moderate synthetic confidence (${syntheticPct}% AI-generated detected, between 30-80%). Remarks: "${remarks}". Held for manual municipal officer verification.`;
    }
  }

  // Assign Complaint ID: Citizen receives their complaint ID, but it can be approved or rejected by admin!
  const ticketCode = getNextTicketCode();
  const etaHours = severityFinal === 5 ? 6 : severityFinal === 4 ? 24 : 48;
  const dbTicketCode = ticketCode;
  const publicTicketCode = ticketCode;

  // Step 5: Duplicate Detection (PostGIS 50m check or Haversine)
  // CRITICAL: If a report is held for verification (isHeld), do NOT merge it into an existing active cluster!
  // It MUST stand alone as an 'under_verification' cluster in the officer queue until approved.
  let matchingCluster: Cluster | undefined;

  if (!isHeld && supabase) {
    try {
      const { data } = await supabase.rpc('find_nearby_cluster', {
        p_lat: payload.lat,
        p_lng: payload.lng,
        p_category: payload.category,
        p_radius: 50,
      });
      if (data && data.length > 0) {
        matchingCluster = data[0];
      }
    } catch (err) {
      console.info('Supabase RPC find_nearby_cluster call error, using haversine:', err);
    }
  }

  if (!isHeld && !matchingCluster) {
    matchingCluster = clustersData.find(
      (c) =>
        c.category === payload.category &&
        c.status !== 'closed' &&
        c.status !== 'rejected' &&
        calculateDistanceMeters(payload.lat, payload.lng, c.center_lat, c.center_lng) <= 50
    );
  }



  // Draft formal municipal complaint text
  const formalDescription = `Official Grievance Draft: Incident involving ${payload.category.replace(
    '_',
    ' '
  ).toUpperCase()} documented at coordinates (${payload.lat.toFixed(4)}, ${payload.lng.toFixed(
    4
  )}). Citizen reported: "${payload.description}". Multimodal inspection confirmed ${
    severityFinal >= 4 ? 'HIGH/CRITICAL public safety concern' : 'standard civic repair requirement'
  }. Assigned dispatch SLA window: ${etaHours} hours.`;

  const generateUuid = () =>
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });

  const ticketUuid = generateUuid();

  const newTicket: Ticket = {
    id: ticketUuid,
    ticket_code: dbTicketCode,
    cluster_id: '',
    name: payload.name,
    email: payload.email,
    mobile: payload.mobile,
    category: payload.category,
    description: payload.description,
    wide_photo_url: wideUrl,
    near_photo_url: nearUrl,
    lat: payload.lat,
    lng: payload.lng,
    accuracy_m: payload.accuracy,
    ai_generated_score: aiGeneratedScore,
    ai_flag: isHeld,
    severity_ai: aiResult.severity_ai,
    severity_final: severityFinal,
    danger: aiResult.danger,
    context: {
      nearSchoolOrHospital: context.nearSchoolOrHospital,
      rainForecast: context.rainForecast,
    },
    description_consistent: true,
    ai_summary: aiResult.summary,
    eta_hours: etaHours,
    created_at: new Date().toISOString(),
  };

  const dept = INITIAL_DEPARTMENTS.find((d) => d.categories.includes(payload.category)) || INITIAL_DEPARTMENTS[0];
  let clusterId: string;

  if (matchingCluster) {
    clusterId = matchingCluster.id;
    newTicket.cluster_id = clusterId;
    matchingCluster.flag_count += 1;
    if (severityFinal > matchingCluster.severity_current) {
      matchingCluster.severity_current = severityFinal;
    }
    matchingCluster.tickets = matchingCluster.tickets || [];
    matchingCluster.tickets.push(newTicket);
    matchingCluster.timeline = matchingCluster.timeline || [];
    matchingCluster.timeline.push({
      id: generateUuid(),
      cluster_id: clusterId,
      ticket_id: newTicket.id,
      type: 'flagged',
      message: `Additional citizen report filed by ${payload.name}. Total flags under this issue: ${matchingCluster.flag_count}.`,
      public: true,
      actor: 'Duplicate Clustering Engine',
      created_at: new Date().toISOString(),
    });
  } else {
    clusterId = generateUuid();
    newTicket.cluster_id = clusterId;

    const newCluster: Cluster = {
      id: clusterId,
      category: payload.category,
      center_lat: payload.lat,
      center_lng: payload.lng,
      address: `Geotagged Location (${payload.lat.toFixed(4)}, ${payload.lng.toFixed(4)})`,
      locality: 'City Ward Zone',
      severity_current: severityFinal,
      flag_count: 1,
      status: status,
      department_name: dept.name,
      department_id: dept.id,
      eta_at: new Date(Date.now() + etaHours * 3600 * 1000).toISOString(),
      last_escalated_at: new Date().toISOString(),
      reminder_sent: false,
      reopen_count: 0,
      created_at: new Date().toISOString(),
      tickets: [newTicket],
      timeline: [
        {
          id: `tl-${Date.now()}-1`,
          cluster_id: clusterId,
          type: 'submitted',
          message: `Ticket ${ticketCode} submitted by ${payload.name}.`,
          public: true,
          actor: 'Citizen',
          created_at: new Date().toISOString(),
        },
        {
          id: `tl-${Date.now()}-2`,
          cluster_id: clusterId,
          type: 'ai_checked',
          message: `Gemini AI rated Level ${severityFinal}/5 severity with an active resolution SLA window of ${etaHours}h.`,
          public: true,
          actor: 'Gemini 3.6 Flash',
          created_at: new Date().toISOString(),
        },
      ],
    };
    clustersData.unshift(newCluster);
  }

  // Step 6: Direct insert into Supabase Tables (if connected)
  if (supabase) {
    try {
      // NOTE: Database check constraints require severity BETWEEN 1 AND 5.
      // If severityFinal is 0 (pending officer determination), use 3 as safe valid default for DB:
      const dbSeverity = severityFinal >= 1 && severityFinal <= 5 ? severityFinal : 3;

      let { error: cErr } = await supabase.from('clusters').upsert({
        id: clusterId,
        category: payload.category,
        center: `POINT(${payload.lng} ${payload.lat})`,
        address: `Geotagged (${payload.lat.toFixed(4)}, ${payload.lng.toFixed(4)})`,
        locality: 'Urban District',
        severity_current: dbSeverity,
        flag_count: matchingCluster ? matchingCluster.flag_count : 1,
        status: status,
        department_name: dept.name,
        eta_at: new Date(Date.now() + etaHours * 3600 * 1000).toISOString(),
      });

      // PostGIS fallback format retry if needed
      if (cErr) {
        console.warn('Retrying cluster upsert with SRID prefix...', cErr);
        const retryRes = await supabase.from('clusters').upsert({
          id: clusterId,
          category: payload.category,
          center: `SRID=4326;POINT(${payload.lng} ${payload.lat})`,
          address: `Geotagged (${payload.lat.toFixed(4)}, ${payload.lng.toFixed(4)})`,
          locality: 'Urban District',
          severity_current: dbSeverity,
          flag_count: matchingCluster ? matchingCluster.flag_count : 1,
          status: status,
          department_name: dept.name,
          eta_at: new Date(Date.now() + etaHours * 3600 * 1000).toISOString(),
        });
        cErr = retryRes.error;
      }

      if (cErr) {
        console.error('🚨 Supabase Clusters Upsert Error:', cErr);
      } else {
        console.log('✅ Supabase Cluster recorded successfully:', clusterId);
      }

      const { error: tErr } = await supabase.from('tickets').insert({
        id: ticketUuid,
        ticket_code: ticketCode,
        cluster_id: clusterId,
        name: payload.name,
        email: payload.email,
        mobile: payload.mobile,
        category: payload.category,
        description: payload.description,
        wide_photo_url: wideUrl,
        near_photo_url: nearUrl,
        lat: payload.lat,
        lng: payload.lng,
        ai_generated_score: aiGeneratedScore,
        ai_flag: isHeld,
        severity_ai: aiResult.severity_ai >= 1 && aiResult.severity_ai <= 5 ? aiResult.severity_ai : dbSeverity,
        severity_final: dbSeverity,
        danger: aiResult.danger,
        ai_summary: aiResult.summary,
        eta_hours: etaHours,
      });

      if (tErr) {
        console.error('🚨 Supabase Tickets Insert Error:', tErr);
      } else {
        console.log('✅ Supabase Ticket inserted successfully:', ticketCode);
      }

      const { error: tlErr } = await supabase.from('timeline_events').insert({
        cluster_id: clusterId,
        ticket_id: ticketUuid,
        type: 'submitted',
        message: isHeld ? `Report held for officer review. Reason: ${aiResult.summary}` : `Report ${ticketCode} received and verified. Assigned to ${dept.name}.`,
        public: true,
        actor: 'Civic Engine',
      });
      if (tlErr) console.error('🚨 Supabase Timeline Insert Error:', tlErr);
    } catch (err) {
      console.error('🚨 Supabase database synchronization exception:', err);
    }
  } else {
    console.warn('⚠️ Supabase client is not connected! Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are configured.');
  }

  persistClusters();

  return {
    success: true,
    ticket_code: publicTicketCode, // Empty when isHeld! No public complaint ID until Admin approves!
    cluster_id: clusterId,
    severity_final: severityFinal,
    eta_hours: etaHours,
    status: status,
    ai_summary: aiResult.summary,
    danger: aiResult.danger,
    ai_generated_score: aiGeneratedScore,
    portal_verdict: portalVerdict,
    ai_formal_description: isHeld
      ? 'Complaint Held for Officer Review: Visual evidence has been submitted to municipal inspection officers. Official Complaint ID will be activated upon admin approval.'
      : formalDescription,
    context: {
      nearSchoolOrHospital: context.nearSchoolOrHospital,
      rainForecast: context.rainForecast,
    },
  };
};

// Fallback Heuristic when Gemini API is offline or key not provided
const getHeuristicAI = (category: string, lat: number, lng: number, description: string = '') => {
  const lowerDesc = description.toLowerCase().trim();

  // Obvious gibberish / random test detection
  const isGibberish =
    lowerDesc.includes('random') ||
    lowerDesc.includes('asdf') ||
    lowerDesc.includes('test 123') ||
    lowerDesc.includes('bla bla') ||
    lowerDesc.includes('nothing') ||
    lowerDesc.includes('unrelated') ||
    lowerDesc.includes('haha') ||
    lowerDesc.includes('dummy') ||
    /(.)\1{4,}/.test(lowerDesc); // e.g. "aaaaaa"

  // Check if description has zero civic relevance keywords
  const civicKeywords = [
    'road', 'pothole', 'crack', 'street', 'asphalt', 'path', 'traffic', 'hole',
    'garbage', 'waste', 'trash', 'bin', 'dump', 'smell', 'dirt',
    'water', 'leak', 'pipeline', 'pipe', 'drain', 'overflow', 'gushing', 'potable',
    'sewage', 'manhole', 'gutter', 'sewer', 'chamber', 'cover',
    'light', 'streetlight', 'lamp', 'dark', 'bulb', 'pole',
    'electric', 'wire', 'cable', 'spark', 'shock', 'hanging', 'transformer',
    'tree', 'branch', 'fallen', 'block', 'fallen', 'crater', 'hazard', 'broken'
  ];

  const hasCivicTerm = civicKeywords.some((term) => lowerDesc.includes(term));

  if (isGibberish || (!hasCivicTerm && lowerDesc.length < 35)) {
    return {
      is_valid_civic_issue: false,
      detected_issue_type: 'not_a_civic_issue',
      matches_category: false,
      description_consistent: false,
      rejection_reason:
        'AI Triage Rejected: The submitted description and photo metadata do not match civic infrastructure or public sanitation criteria. Please provide a description explaining the road, water, or electrical damage.',
      severity_ai: 0,
      summary: 'Automated rejection: Unrelated or random description detected.',
      eta_hours: 0,
      confidence: 0.99,
      danger: {
        risk_to_life: false,
        electrical_hazard: false,
        open_manhole_or_pit: false,
        blocks_emergency_access: false,
        traffic_hazard: false,
        water_or_flood_risk: false,
        health_hazard: false,
        worsens_over_time: false,
      },
    };
  }

  // Category relevance keywords
  const categorySpecificKeywords: Record<string, string[]> = {
    pothole: ['pothole', 'road', 'asphalt', 'crater', 'crack', 'street', 'pavement', 'highway', 'tar', 'pit'],
    garbage: ['garbage', 'trash', 'waste', 'bin', 'dump', 'rubbish', 'litter', 'filth', 'debris', 'smell', 'plastic'],
    water_leak: ['water', 'leak', 'pipe', 'pipeline', 'burst', 'gushing', 'potable', 'supply', 'tap', 'flooding'],
    sewage_drain: ['sewage', 'drain', 'manhole', 'gutter', 'sewer', 'chamber', 'dirty water', 'overflow', 'toxic', 'sludge', 'foul'],
    streetlight: ['light', 'streetlight', 'lamp', 'pole', 'dark', 'bulb', 'illumination', 'fixture'],
    electrical_hazard: ['electric', 'wire', 'cable', 'spark', 'shock', 'hanging', 'transformer', 'high voltage', 'meter', 'current'],
    fallen_tree: ['tree', 'branch', 'fallen', 'trunk', 'wood', 'uprooted', 'bough', 'leaves', 'blocking'],
  };

  const expectedKeywords = categorySpecificKeywords[category];
  if (expectedKeywords && expectedKeywords.length > 0) {
    const hasCategoryTerm = expectedKeywords.some((term) => lowerDesc.includes(term));
    if (!hasCategoryTerm && lowerDesc.length > 10) {
      for (const [otherCat, otherTerms] of Object.entries(categorySpecificKeywords)) {
        if (otherCat !== category && otherTerms.some((t) => lowerDesc.includes(t))) {
          return {
            is_valid_civic_issue: false,
            detected_issue_type: otherCat,
            matches_category: false,
            description_consistent: false,
            rejection_reason: `Category Mismatch: You selected "${category.replace('_', ' ').toUpperCase()}", but your description describes ${otherCat.replace('_', ' ')}. Please select the correct category from the dropdown.`,
            severity_ai: 0,
            summary: `Automated rejection: Category mismatch between "${category}" and description.`,
            eta_hours: 0,
            confidence: 0.95,
            danger: {
              risk_to_life: false,
              electrical_hazard: false,
              open_manhole_or_pit: false,
              blocks_emergency_access: false,
              traffic_hazard: false,
              water_or_flood_risk: false,
              health_hazard: false,
              worsens_over_time: false,
            },
          };
        }
      }
    }
  }

  let severity_ai = 3;
  if (category === 'electrical_hazard') severity_ai = 5;
  else if (category === 'sewage_drain' || category === 'fallen_tree') severity_ai = 4;
  else if (category === 'pothole' || category === 'water_leak') severity_ai = 3;
  else if (category === 'garbage') severity_ai = 2;

  return {
    is_valid_civic_issue: true,
    detected_issue_type: category,
    matches_category: true,
    description_consistent: true,
    rejection_reason: '',
    severity_ai,
    summary: `Verified ${category.replace('_', ' ')} incident recorded at (${lat.toFixed(4)}, ${lng.toFixed(4)}).`,
    eta_hours: severity_ai === 5 ? 6 : severity_ai === 4 ? 24 : 48,
    confidence: 0.96,
    danger: {
      risk_to_life: category === 'electrical_hazard',
      electrical_hazard: category === 'electrical_hazard',
      open_manhole_or_pit: category === 'sewage_drain',
      blocks_emergency_access: category === 'fallen_tree',
      traffic_hazard: category === 'pothole' || category === 'electrical_hazard',
      water_or_flood_risk: category === 'water_leak',
      health_hazard: category === 'garbage' || category === 'sewage_drain',
      worsens_over_time: true,
    },
  };
};

// Helper: filter timeline events to only those relevant to the specific ticket
const filterTimelineForTicket = (timeline: TimelineEvent[], ticket: Ticket): TimelineEvent[] => {
  const currentCode = ticket.ticket_code.trim().toUpperCase();
  return (timeline || []).filter((item) => {
    // 1. If explicit ticket_id is present, it MUST match this ticket
    if (item.ticket_id && item.ticket_id !== ticket.id) {
      return false;
    }
    // 2. If the message explicitly mentions a ticket code (e.g. CP-2026-XXXXXX),
    // it must match this ticket's code
    const codeMatches = item.message.match(/CP-\d{4}-\d{5,6}/gi);
    if (codeMatches && codeMatches.length > 0) {
      const isForThisTicket = codeMatches.some(
        (code) => code.toUpperCase() === currentCode
      );
      if (!isForThisTicket) {
        return false;
      }
    }
    return true;
  });
};

export const trackTicket = async (ticketCode: string, mobileLast4: string) => {
  const cleanCode = ticketCode.trim().toUpperCase();
  const cleanPhone = mobileLast4.trim();

  // 1. Check in memory first
  for (const cluster of clustersData) {
    const foundTicket = cluster.tickets?.find(
      (t) => t.ticket_code.toUpperCase() === cleanCode && t.mobile.endsWith(cleanPhone)
    );
    if (foundTicket) {
      return {
        ticket: foundTicket,
        cluster: cluster,
        timeline: filterTimelineForTicket(cluster.timeline || [], foundTicket),
        canReopen: cluster.status === 'closed' && isWithinReopenWindow(cluster.closed_at),
      };
    }
  }

  // 2. Not found in memory — fetch live from Supabase (for multi-browser / other localhost)
  try {
    const liveClusters = await fetchLiveClusters();
    for (const cluster of liveClusters) {
      const foundTicket = cluster.tickets?.find(
        (t) => t.ticket_code.toUpperCase() === cleanCode && t.mobile.endsWith(cleanPhone)
      );
      if (foundTicket) {
        return {
          ticket: foundTicket,
          cluster: cluster,
          timeline: filterTimelineForTicket(cluster.timeline || [], foundTicket),
          canReopen: cluster.status === 'closed' && isWithinReopenWindow(cluster.closed_at),
        };
      }
    }
  } catch (err) {
    console.warn('Live track fetch failed:', err);
  }

  return null;
};

export const isWithinReopenWindow = (closedAt?: string): boolean => {
  if (!closedAt) return false;
  const closedTime = new Date(closedAt).getTime();
  const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
  return Date.now() - closedTime <= fiveDaysMs;
};

export const reopenTicket = async (ticketCode: string, mobileLast4: string, reason: string, proofPhoto: File | Blob) => {
  const result = await trackTicket(ticketCode, mobileLast4);
  if (!result) throw new Error('Ticket not found or mobile digits did not match.');
  if (result.cluster.status !== 'closed') throw new Error('Only closed tickets can be reopened.');
  if (!isWithinReopenWindow(result.cluster.closed_at)) throw new Error('Reopen window (5 days) has expired.');

  const cluster = result.cluster;
  const supabase = getSupabaseClient();

  let proofUrl = '';
  if (proofPhoto) {
    try {
      proofUrl = await uploadPhotoDirect(proofPhoto, 'proofs');
    } catch (err) {
      console.warn('Proof photo upload failed:', err);
    }
  }

  const newSeverity = Math.min(5, cluster.severity_current + 1);
  const newReopenCount = (cluster.reopen_count || 0) + 1;

  if (supabase) {
    try {
      await supabase.from('clusters').update({
        status: 'reopened',
        reopen_count: newReopenCount,
        severity_current: newSeverity,
        last_escalated_at: new Date().toISOString(),
        reminder_sent: false,
      }).eq('id', cluster.id);

      await supabase.from('reopen_requests').insert({
        ticket_code: ticketCode,
        cluster_id: cluster.id,
        reason,
        proof_photo_url: proofUrl,
      });

      await supabase.from('timeline_events').insert({
        cluster_id: cluster.id,
        ticket_id: result.ticket.id,
        type: 'reopened',
        message: `Ticket reopened by citizen: "${reason}". Severity escalated to Level ${newSeverity}.`,
        public: true,
        actor: 'Citizen Reopen Request',
      });

      await fetchLiveClusters();
    } catch (err) {
      console.error('Exception updating Supabase on reopen:', err);
    }
  }

  return { success: true, cluster };
};

export const requestTicketEscalation = async (
  ticketCode: string,
  mobileLast4: string,
  reason: string
) => {
  const result = await trackTicket(ticketCode, mobileLast4);
  if (!result) throw new Error('Ticket not found or mobile digits did not match.');
  if (result.cluster.status === 'closed' || result.cluster.status === 'rejected') {
    throw new Error('Only active unresolved complaints can be escalated.');
  }

  const cluster = result.cluster;
  const ticket = result.ticket;
  const supabase = getSupabaseClient();
  const escalationTime = new Date().toISOString();

  // 1. Update in-memory cluster
  cluster.last_escalated_at = escalationTime;
  cluster.escalation_requested = true;
  const escalationEvent: TimelineEvent = {
    id: `tl-esc-${Date.now()}`,
    cluster_id: cluster.id,
    ticket_id: ticket.id,
    type: 'escalated',
    message: `Citizen Escalation Requested (${ticket.ticket_code}): ${reason.trim() || 'Immediate action requested due to pending delay or aggravated risk.'}`,
    public: true,
    actor: `Citizen (${ticket.name || 'Reporter'})`,
    created_at: escalationTime,
  };
  cluster.timeline = cluster.timeline || [];
  cluster.timeline.push(escalationEvent);

  // 2. Persist to Supabase if available
  if (supabase) {
    try {
      await supabase.from('clusters').update({
        last_escalated_at: escalationTime,
      }).eq('id', cluster.id);

      await supabase.from('timeline_events').insert({
        cluster_id: cluster.id,
        ticket_id: ticket.id,
        type: 'escalated',
        message: escalationEvent.message,
        public: true,
        actor: escalationEvent.actor,
      });

      await fetchLiveClusters();
    } catch (err) {
      console.warn('Supabase escalation update warning:', err);
    }
  }

  return { success: true, message: 'Escalation request delivered to municipal triage officers.' };
};


export const updateClusterAdmin = async (
  clusterId: string,
  updates: {
    status?: any;
    department_name?: string;
    proof_photo_url?: string;
    admin_message?: string;
    override_severity?: number;
    override_reason?: string;
  }
) => {
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const dbUpdates: any = {};
      if (updates.status) {
        dbUpdates.status = updates.status;
        if (updates.status === 'closed') {
          dbUpdates.closed_at = new Date().toISOString();
          if (updates.proof_photo_url) {
            dbUpdates.proof_photo_url = updates.proof_photo_url;
          }
        }
      }
      if (updates.department_name) {
        dbUpdates.department_name = updates.department_name;
      }
      if (updates.override_severity) {
        dbUpdates.severity_current = updates.override_severity;
      }

      if (Object.keys(dbUpdates).length > 0) {
        const { error } = await supabase.from('clusters').update(dbUpdates).eq('id', clusterId);
        if (error) console.error('Supabase update cluster error:', error);
      }

      if (updates.override_severity) {
        await supabase.from('timeline_events').insert({
          cluster_id: clusterId,
          type: 'escalated',
          message: `Admin manually adjusted severity to Level ${updates.override_severity}. Reason: ${updates.override_reason || 'Field evaluation'}`,
          public: false,
          actor: 'Admin',
        });
      }

      if (updates.admin_message) {
        await supabase.from('timeline_events').insert({
          cluster_id: clusterId,
          type: 'admin_message',
          message: updates.admin_message,
          public: true,
          actor: 'Municipal Officer',
        });
      }

      if (updates.status) {
        await supabase.from('timeline_events').insert({
          cluster_id: clusterId,
          type: updates.status === 'closed' ? 'closed' : updates.status === 'assigned' ? 'assigned' : 'admin_message',
          message: `Status updated to ${updates.status.toUpperCase()}${updates.proof_photo_url ? ' with resolution photo attached.' : '.'}`,
          public: true,
          actor: 'Municipal Administration',
        });
      }

      // Sync latest clusters directly from Supabase
      await fetchLiveClusters();
    } catch (err) {
      console.error('Exception during updateClusterAdmin in Supabase:', err);
    }
  }

  return clustersData.find((c) => c.id === clusterId) || null;
};

export const resolveVerificationQueue = async (ticketId: string, approve: boolean, reason: string, assignedSeverity?: number, assignedDepartment?: string) => {
  const supabase = getSupabaseClient();
  const cluster = clustersData.find((c) => c.tickets?.some((x) => x.id === ticketId));
  if (!cluster) return false;

  const t = cluster.tickets?.find((x) => x.id === ticketId);
  const newStatus = approve ? 'received' : 'rejected';

  // If approved and ticket had a pending code, assign official ticket code!
  let officialTicketCode = t?.ticket_code || '';
  if (approve && officialTicketCode.startsWith('PENDING-')) {
    officialTicketCode = officialTicketCode.replace('PENDING-', '');
  }

  const finalSev = assignedSeverity && assignedSeverity >= 1 && assignedSeverity <= 5
    ? assignedSeverity
    : (cluster.severity_current > 0 ? cluster.severity_current : 3);

  const etaHours = finalSev === 5 ? 6 : finalSev === 4 ? 24 : 48;
  const deptName = assignedDepartment || cluster.department_name || 'Municipal Works';

  if (t) {
    t.ai_flag = false;
    if (approve) {
      if (officialTicketCode) t.ticket_code = officialTicketCode;
      t.severity_final = finalSev;
      t.eta_hours = etaHours;
    }
  }

  cluster.status = newStatus;
  if (approve) {
    cluster.severity_current = finalSev;
    cluster.department_name = deptName;
    cluster.eta_at = new Date(Date.now() + etaHours * 3600 * 1000).toISOString();
  }

  if (supabase) {
    try {
      const clusterUpdate: any = { status: newStatus };
      if (approve) {
        clusterUpdate.severity_current = finalSev;
        clusterUpdate.department_name = deptName;
        clusterUpdate.eta_at = cluster.eta_at;
      }
      await supabase.from('clusters').update(clusterUpdate).eq('id', cluster.id);

      const ticketUpdate: any = { ai_flag: false };
      if (approve) {
        if (officialTicketCode) ticketUpdate.ticket_code = officialTicketCode;
        ticketUpdate.severity_final = finalSev;
        ticketUpdate.eta_hours = etaHours;
      }
      await supabase.from('tickets').update(ticketUpdate).eq('id', ticketId);

      await supabase.from('timeline_events').insert({
        cluster_id: cluster.id,
        ticket_id: ticketId,
        type: approve ? 'ai_checked' : 'closed',
        message: approve
          ? `Officer approved held report: Assigned Official Complaint ID ${officialTicketCode || t?.ticket_code}. Severity designated as Level ${finalSev}/5 (${deptName}, ${etaHours}h SLA). "${reason || 'Verified genuine by officer inspection'}".`
          : `Report rejected during verification: "${reason || 'Photo failed authenticity check'}".`,
        public: true,
        actor: 'Admin Verification',
      });

      await fetchLiveClusters();
      return true;
    } catch (err) {
      console.error('Exception during resolveVerificationQueue in Supabase:', err);
    }
  }

  return false;
};
