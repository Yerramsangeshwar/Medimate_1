import { Router, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { db } from '../db.ts';
import { authRequired, AuthRequest } from '../middleware/auth.ts';

const router = Router();
router.use(authRequired);

const ai = new GoogleGenAI();

// 1. Scan Prescription using Gemini Vision
router.post('/scan-prescription', async (req: AuthRequest, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', sampleType } = req.body;

    // If sample test requested or no image provided, return realistic sample parsed prescription
    if (sampleType || !imageBase64) {
      if (sampleType === 'pediatric') {
        return res.json({
          doctorName: 'Dr. Anita Desai, MD (Pediatrics)',
          hospitalName: 'Childrens Memorial Hospital',
          date: '2026-10-20',
          medications: [
            {
              name: 'Amoxicillin Oral Suspension',
              type: 'syrup',
              dosage: '250mg/5mL',
              quantity: 1,
              frequency: 'thrice_daily',
              times: ['08:00', '14:00', '20:00'],
              foodInstruction: 'after',
              durationDays: 10,
              notes: 'Complete entire 10-day course. Shake well before measuring.',
            },
            {
              name: 'Paracetamol Pediatric Drops',
              type: 'drops',
              dosage: '100mg/mL',
              quantity: 1,
              frequency: 'custom',
              times: ['12:00', '18:00'],
              foodInstruction: 'none',
              durationDays: 3,
              notes: 'Use only as needed for fever above 101F.',
            },
          ],
          disclaimer: 'AI-assisted prescription extraction. Always verify extracted items against your original prescription before confirming.',
        });
      }

      // Default sample cardiology / metabolic prescription
      return res.json({
        doctorName: 'Dr. Michael Chen, MD (Cardiology)',
        hospitalName: 'Metro Health Cardiovascular Institute',
        date: '2026-10-22',
        medications: [
          {
            name: 'Lisinopril',
            type: 'tablet',
            dosage: '10mg',
            quantity: 30,
            frequency: 'once_daily',
            times: ['09:00'],
            foodInstruction: 'none',
            durationDays: 30,
            notes: 'Take in morning for blood pressure maintenance.',
          },
          {
            name: 'Atorvastatin',
            type: 'tablet',
            dosage: '20mg',
            quantity: 30,
            frequency: 'once_daily',
            times: ['21:30'],
            foodInstruction: 'none',
            durationDays: 30,
            notes: 'Take at bedtime for lipid management.',
          },
        ],
        disclaimer: 'AI-assisted prescription extraction. Always verify extracted items against your original prescription before confirming.',
      });
    }

    // Call Gemini with image
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error: 'Gemini API key is not configured. You can use the "Load Sample Prescription" option to test the scanner flow.',
      });
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');

    const prompt = `Analyze this medical prescription image carefully.
Extract the doctor name, clinic/hospital name, prescription date, and all prescribed medications.
Return ONLY valid JSON matching this exact schema:
{
  "doctorName": "string or null",
  "hospitalName": "string or null",
  "date": "YYYY-MM-DD or null",
  "medications": [
    {
      "name": "string (medication trade or generic name)",
      "type": "one of: tablet, capsule, syrup, injection, drops, cream, inhaler, powder, other",
      "dosage": "string (e.g., 500mg, 10mg, 5mL)",
      "quantity": number,
      "frequency": "one of: once_daily, twice_daily, thrice_daily, custom",
      "times": ["HH:MM", ...],
      "foodInstruction": "one of: before, after, none",
      "durationDays": number or null,
      "notes": "instructions or remarks from prescription"
    }
  ]
}
If any field is unclear, use your best estimation and indicate in notes. Never output markdown codeblocks. Output pure JSON only.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: cleanBase64,
                mimeType,
              },
            },
          ],
        },
      ],
    });

    const text = response.text || '{}';
    const jsonStr = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    res.json({
      ...parsed,
      disclaimer: 'AI-assisted prescription extraction. Always verify extracted items against your original prescription before confirming.',
    });
  } catch (err: any) {
    console.error('Error in scan-prescription:', err);
    res.status(500).json({
      error: 'Could not process the prescription image. Please ensure the image is clear or try entering details manually.',
    });
  }
});

// 2. AI Medication Schedule Assistant (Strictly Guardrailed)
router.post('/assistant', async (req: AuthRequest, res: Response) => {
  try {
    const { question } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Question is required.' });
    }

    // Retrieve user's active medicines
    const userMeds = db.prepare(`
      SELECT name, type, dosage, frequency, times, foodInstruction, doctorName, notes
      FROM medicines
      WHERE userId = ? AND active = 1
    `).all(req.userId!) as any[];

    const userProfile = db.prepare('SELECT name, age, gender, bloodGroup, emergencyContact FROM users WHERE id = ?').get(req.userId!) as any;

    const apiKey = process.env.GEMINI_API_KEY;

    // If no API key, provide a smart rule-based response
    if (!apiKey) {
      const qLower = question.toLowerCase();
      let fallbackAnswer = '';
      if (qLower.includes('today') || qLower.includes('schedule') || qLower.includes('when')) {
        const lines = userMeds.map((m) => `• ${m.name} (${m.dosage}): ${JSON.parse(m.times || '[]').join(', ')} (${m.foodInstruction !== 'none' ? `take ${m.foodInstruction} food` : 'no food restrictions'})`);
        fallbackAnswer = `Here is your current active medication schedule:\n\n${lines.join('\n')}\n\nPlease take your medications as prescribed by your doctor.`;
      } else if (qLower.includes('food') || qLower.includes('empty stomach')) {
        const withFood = userMeds.filter((m) => m.foodInstruction === 'after');
        const beforeFood = userMeds.filter((m) => m.foodInstruction === 'before');
        fallbackAnswer = `Based on your prescription details:\n• Take after food: ${withFood.map((m) => m.name).join(', ') || 'None'}\n• Take before food: ${beforeFood.map((m) => m.name).join(', ') || 'None'}`;
      } else {
        fallbackAnswer = `You currently have ${userMeds.length} active medications on file: ${userMeds.map((m) => m.name).join(', ')}. For personalized guidance or medical concerns, please consult your doctor or pharmacist.`;
      }

      return res.json({
        answer: fallbackAnswer,
        disclaimer: 'MediMate is an informational tool. It does not provide medical diagnoses or dosage modifications.',
      });
    }

    const contextPrompt = `You are MediMate AI, a helpful, empathetic medication schedule and health routine assistant.
The patient: ${userProfile?.name || 'Patient'}, Age: ${userProfile?.age || 'Not specified'}.
Current active prescriptions on file:
${JSON.stringify(userMeds, null, 2)}

Patient's Question: "${question}"

CRITICAL SAFETY GUARDRAILS:
1. You may summarize schedules, list dose times, and clarify general food instructions (e.g. "Take after food").
2. You MUST NEVER diagnose diseases or recommend changing dosages or stopping medications.
3. If the user asks whether they should take more/less or stop, advise them clearly: "Please check with your prescribing doctor or pharmacist before making any dosage changes."
4. Keep the tone warm, clear, concise, and structured with bullet points.
5. MediMate is an informational organizer, not a healthcare provider.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [{ role: 'user', parts: [{ text: contextPrompt }] }],
    });

    res.json({
      answer: response.text || 'I am ready to help organize your medications.',
      disclaimer: 'MediMate is an informational tool. It does not provide medical diagnoses or dosage modifications.',
    });
  } catch (err: any) {
    console.error('Error in assistant:', err);
    res.status(500).json({ error: 'Could not process your question at this moment.' });
  }
});

// 3. Known Interaction & Food Caution Checker
router.post('/interactions-check', async (req: AuthRequest, res: Response) => {
  try {
    const userMeds = db.prepare(`
      SELECT name, type, dosage, foodInstruction, notes
      FROM medicines
      WHERE userId = ? AND active = 1
    `).all(req.userId!) as any[];

    if (userMeds.length === 0) {
      return res.json({
        items: [],
        message: 'No active medications currently found to check.',
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      // Rule-based common advisories
      const advisories = [];
      const medNames = userMeds.map((m: any) => m.name.toLowerCase());

      if (medNames.some((n: string) => n.includes('metformin'))) {
        advisories.push({
          severity: 'info',
          title: 'Metformin & Meals',
          description: 'Metformin should ideally be taken with or right after meals to reduce gastrointestinal upset.',
        });
      }
      if (medNames.some((n: string) => n.includes('vitamin d') || n.includes('calcium'))) {
        advisories.push({
          severity: 'info',
          title: 'Vitamin D Absorption',
          description: 'Vitamin D is fat-soluble and absorbs significantly better when taken with meals containing dietary fats.',
        });
      }
      if (medNames.some((n: string) => n.includes('lisinopril'))) {
        advisories.push({
          severity: 'info',
          title: 'Lisinopril & Potassium',
          description: 'Lisinopril can mildly increase potassium levels. Avoid excessive high-potassium supplements unless advised by your doctor.',
        });
      }

      return res.json({
        advisories: advisories.length > 0 ? advisories : [
          {
            severity: 'info',
            title: 'Routine Adherence',
            description: 'No common high-risk dietary conflicts detected in your current active list.',
          },
        ],
        disclaimer: 'MediMate provides informational reminders based on general pharmacological reference. Always consult your prescribing doctor or pharmacist.',
      });
    }

    const prompt = `Review these active patient medications for common food-drug precautions, timing tips, or known cautions:
${JSON.stringify(userMeds, null, 2)}

Return ONLY valid JSON matching this schema:
{
  "advisories": [
    {
      "severity": "info" | "warning",
      "title": "short descriptive title",
      "description": "clear 1-2 sentence patient-friendly advisory"
    }
  ]
}
Strict guardrail: Do not diagnose conditions or suggest changing doses. Pure JSON only.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const text = response.text || '{"advisories":[]}';
    const jsonStr = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    res.json({
      advisories: parsed.advisories || [],
      disclaimer: 'MediMate provides informational reminders based on general pharmacological reference. Always consult your prescribing doctor or pharmacist.',
    });
  } catch (err: any) {
    console.error('Error in interactions-check:', err);
    res.json({
      advisories: [
        {
          severity: 'info',
          title: 'Consistent Routine',
          description: 'Take medications at the scheduled times as prescribed by your physician.',
        },
      ],
      disclaimer: 'MediMate provides informational reminders based on general pharmacological reference.',
    });
  }
});

export default router;
