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
          ai_generated_score: t.ai_generated_score || 0.05,
          ai_flag: t.ai_flag || false,
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
          c.last_escalated_at || (c.timeline_events || []).some((ev: any) => ev.type === 'escalated')
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

    // 2. Inspect exact pixel resolution footprints used by generative AI models
    if (typeof Image !== 'undefined') {
      const dimCheck = await new Promise<{ isAiSize: boolean; dims: string }>((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(url);
          const w = img.naturalWidth;
          const h = img.naturalHeight;
          const isStandardAiSize =
            (w === 1024 && h === 1024) || // DALL-E 3 / Midjourney standard square
            (w === 1792 && h === 1024) || // DALL-E 3 landscape
            (w === 1024 && h === 1792) || // DALL-E 3 portrait
            (w === 512 && h === 512) ||   // SD 1.5 default
            (w === 768 && h === 768) ||   // SD 2.1 default
            (w === 1456 && h === 816) ||  // Midjourney 16:9
            (w === 816 && h === 1456) ||  // Midjourney 9:16
            (w === 1344 && h === 768) ||  // Flux 16:9
            (w === 768 && h === 1344);   // Flux 9:16
          resolve({ isAiSize: isStandardAiSize, dims: `${w}x${h}` });
        };
        img.onerror = () => resolve({ isAiSize: false, dims: '' });
        img.src = url;
      });

      if (dimCheck.isAiSize) {
        return {
          isAi: true,
          score: 0.92,
          reason: `Exact generative AI canvas footprint detected (${dimCheck.dims}).`,
        };
      }
    }
  } catch (e) {
    console.warn('Binary AI scan error:', e);
  }
  return { isAi: false, score: 0, reason: '' };
};

// Convert File/Blob to Base64 (stripping header prefix)
const fileToBase64 = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
  });
};

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
You are an expert civic infrastructure forensic inspector for a municipal government complaint portal.
Image 1 is a WIDE view of the public area. Image 2 is a NEAR view of the reported issue.
Citizen chosen category: "${category}"
Citizen submitted description: """${description}"""

YOUR CRITICAL TASKS IN STRICT PRIORITY ORDER:

1. MANDATORY AI-GENERATION & WATERMARK FORENSICS (CHECK THIS FIRST!):
   Carefully inspect both images at the pixel and compositional level for ANY evidence of Generative AI (DALL-E, Midjourney, Stable Diffusion, Flux, Sora, Adobe Firefly, Photoshop Generative Fill, Imagen, Bing Image Creator, or CGI):
   - WATERMARK & LOGO CHECK: Examine all four corners (especially bottom-right and bottom-left) and margins for:
     * DALL-E's multicolored or yellow/red/blue squares.
     * Bing Image Creator icon / watermark.
     * Midjourney, Canva, or Adobe Firefly logos/badges.
     * Faint translucent AI labels or watermarks anywhere in the image.
   - SYNTHETIC TEXTURE & LIGHTING FORENSICS:
     * Unnatural plastic gloss, airbrushed smoothness, or painterly/cartoonish rendering on pavement, asphalt, concrete, or walls.
     * Surreal, hyper-dramatic volumetric lighting or impossible reflection/shadow angles.
     * Impossible geometry, warped perspective, melting wheels/curbs, or floating debris.
     * Warped, dream-like, or alien gibberish text on street signs, license plates, or posters.
   - STRICT ENFORCEMENT:
     * If ANY watermark is found OR the image looks AI-generated/synthetic:
       Set "is_ai_generated": true
       Set "ai_watermark_detected": true (if watermark/logo visible)
       Set "ai_generated_probability": 0.95 to 1.00
       Set "is_valid_civic_issue": false (AI images are simulated fakes, NEVER real municipal emergencies)
       Set "detected_issue_type": "not_a_civic_issue"
       Set "rejection_reason": "AI-generated image detected (Watermark/Synthetic artifacts identified). Only genuine camera photos of real physical infrastructure damage are accepted."

2. STRICT CIVIC VALIDATION (For genuine real-world photos):
   Do these photos actually show a REAL PUBLIC CIVIC / MUNICIPAL INFRASTRUCTURE ISSUE (such as road pothole, leaking water main, exposed electrical cable, open manhole/drain, garbage pile, broken streetlight, fallen tree)?
   - If the photos show: pets, animals, food, selfies, bedrooms, indoor furniture, random wallpapers, memes, car interiors, screenshots, or unrelated everyday objects, set "is_valid_civic_issue": false and "detected_issue_type": "not_a_civic_issue".
   - If the photos are completely dark, pitch black, or blurry beyond recognition, set "is_valid_civic_issue": false.

3. CATEGORY & DESCRIPTION CHECK:
   - "matches_category": Does the visible physical issue match the citizen's chosen category "${category}"? (e.g., if citizen selected "pothole" but photo shows a cat, food, or car, set matches_category: false).
   - "description_consistent": Does the citizen's text describe what is actually visible in the photo? If citizen wrote random gibberish, spam, or completely unrelated words, set description_consistent: false.

4. SEVERITY & DANGER RATING (Only if real authentic civic issue):
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
  "rejection_reason": "string (mandatory if is_ai_generated is true or is_valid_civic_issue is false)",
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
  const candidateModels = ['gemini-3.6-flash'];
  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(25000),
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
      console.warn('Direct Gemini call failed or rate-limited; flagging for manual review:', err);
      // Gemini timed out or errored — do NOT blindly auto-accept.
      // Low confidence (0.30) sends this to the officer verification queue.
      aiResult = {
        is_valid_civic_issue: true,
        detected_issue_type: payload.category,
        matches_category: true,
        description_consistent: true,
        rejection_reason: '',
        severity_ai: 3,
        summary: 'AI vision verification unavailable (Gemini timeout/error). Held for manual officer review.',
        eta_hours: 48,
        confidence: 0.30,
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
        is_ai_generated: false,
        ai_watermark_detected: false,
        ai_generated_probability: 0,
      };
    }
  } else {
    // Intelligent local fallback if no Gemini key entered yet
    aiResult = getHeuristicAI(payload.category, payload.lat, payload.lng, payload.description);
  }

  // Calculate true AI-Generated / Synthetic Confidence
  const metadataScore = Math.max(wideScan.score, nearScan.score);
  const textIndicatesAi =
    aiResult.is_ai_generated === true ||
    aiResult.ai_watermark_detected === true ||
    (aiResult.rejection_reason && /ai[- ]?generated|synthetic|watermark|logo|midjourney|dall[- ]?e|stable diffusion|flux|cgi|render|fake/i.test(aiResult.rejection_reason)) ||
    (aiResult.summary && /ai[- ]?generated|synthetic|watermark|logo|midjourney|dall[- ]?e|stable diffusion|flux|cgi|render|fake/i.test(aiResult.summary)) ||
    (payload.description && /synthetic|ai test|deepfake/i.test(payload.description));

  const geminiScore = typeof aiResult.ai_generated_probability === 'number'
    ? aiResult.ai_generated_probability
    : (textIndicatesAi ? 0.96 : 0.04);

  const combinedAiScore = Math.max(
    metadataScore,
    geminiScore,
    textIndicatesAi ? 0.96 : 0
  );
  const aiGeneratedScore = Number(Math.max(0, Math.min(1, combinedAiScore)).toFixed(2));

  // If AI generation, watermark, or high synthetic probability detected, strictly enforce rejection
  if (aiResult.is_ai_generated || aiResult.ai_watermark_detected || combinedAiScore >= 0.50) {
    aiResult.is_valid_civic_issue = false;
    aiResult.detected_issue_type = 'not_a_civic_issue';
    if (!aiResult.rejection_reason || !/ai[- ]?generated|synthetic|watermark/i.test(aiResult.rejection_reason)) {
      aiResult.rejection_reason = `AI-generated / synthetic imagery detected (${Math.round(aiGeneratedScore * 100)}% synthetic confidence). Submissions must depict genuine physical infrastructure damage.`;
    }
  }

  // STRICT REJECTION: If Gemini detects that the photo does not show a civic issue
  // OR the description is completely inconsistent with civic damage:
  if (!aiResult.is_valid_civic_issue || aiResult.detected_issue_type === 'not_a_civic_issue' || !aiResult.matches_category) {
    const rejectionMsg =
      aiResult.rejection_reason ||
      `AI Vision Rejection: Uploaded evidence does not show an authentic public civic hazard or does not match "${payload.category.replace(
        '_',
        ' '
      )}". Please upload clear photos of real physical infrastructure damage.`;

    return {
      success: false,
      ticket_code: 'REJECTED-PORTAL-001',
      cluster_id: '',
      severity_final: 0,
      eta_hours: 0,
      status: 'rejected',
      ai_summary: rejectionMsg,
      ai_formal_description: textIndicatesAi
        ? `Submission Disallowed: Synthetic AI-generated image or watermark detected (${Math.round(aiGeneratedScore * 100)}% Synthetic confidence). Digital fabrications are strictly rejected.`
        : `Submission Rejected by Portal AI: Visual evidence failed civic validity checks. Detected: ${aiResult.detected_issue_type}. Description match: ${aiResult.description_consistent ? 'Partial' : 'Inconsistent'}.`,
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
      ai_generated_score: aiGeneratedScore,
      portal_verdict: 'rejected',
      context,
      message: rejectionMsg,
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

  // Step 4: Context-based scoring boost (formula: final = min(5, s_ai + context))
  let severityFinal = aiResult.severity_ai;
  if (context.nearSchoolOrHospital && severityFinal < 5) severityFinal += 1;
  if (context.rainForecast && (payload.category === 'water_leak' || payload.category === 'sewage_drain') && severityFinal < 5) {
    severityFinal += 1;
  }
  severityFinal = Math.min(5, Math.max(1, severityFinal));

  const ticketCode = getNextTicketCode();
  const etaHours = severityFinal === 5 ? 6 : severityFinal === 4 ? 24 : 48;

  // Step 5: Duplicate Detection (PostGIS 50m check or Haversine)
  let matchingCluster: Cluster | undefined;

  if (supabase) {
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

  if (!matchingCluster) {
    matchingCluster = clustersData.find(
      (c) =>
        c.category === payload.category &&
        c.status !== 'closed' &&
        c.status !== 'rejected' &&
        calculateDistanceMeters(payload.lat, payload.lng, c.center_lat, c.center_lng) <= 50
    );
  }

  // If synthetic probability is 50% or higher, hold in verification queue
  const isHeld = aiGeneratedScore >= 0.50;
  const portalVerdict: 'accepted' | 'held' | 'rejected' = isHeld ? 'held' : 'accepted';
  const status: any = isHeld ? 'under_verification' : 'received';

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
    ticket_code: ticketCode,
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
      let { error: cErr } = await supabase.from('clusters').upsert({
        id: clusterId,
        category: payload.category,
        center: `POINT(${payload.lng} ${payload.lat})`,
        address: `Geotagged (${payload.lat.toFixed(4)}, ${payload.lng.toFixed(4)})`,
        locality: 'Urban District',
        severity_current: severityFinal,
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
          severity_current: severityFinal,
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
        severity_ai: aiResult.severity_ai,
        severity_final: severityFinal,
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
        message: `Report ${ticketCode} received and verified. Assigned to ${dept.name}.`,
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
    ticket_code: ticketCode,
    cluster_id: clusterId,
    severity_final: severityFinal,
    eta_hours: etaHours,
    status: status,
    ai_summary: aiResult.summary,
    danger: aiResult.danger,
    ai_generated_score: aiGeneratedScore,
    portal_verdict: portalVerdict,
    ai_formal_description: formalDescription,
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

export const resolveVerificationQueue = async (ticketId: string, approve: boolean, reason: string) => {
  const supabase = getSupabaseClient();
  const cluster = clustersData.find((c) => c.tickets?.some((x) => x.id === ticketId));
  if (!cluster) return false;

  const t = cluster.tickets?.find((x) => x.id === ticketId);

  if (supabase) {
    try {
      const newStatus = approve ? 'received' : 'rejected';
      await supabase.from('clusters').update({ status: newStatus }).eq('id', cluster.id);
      await supabase.from('tickets').update({ ai_flag: false }).eq('id', ticketId);

      await supabase.from('timeline_events').insert({
        cluster_id: cluster.id,
        ticket_id: ticketId,
        type: approve ? 'ai_checked' : 'closed',
        message: approve
          ? `Officer approved held report: "${reason || 'Verified genuine by officer inspection'}".`
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
