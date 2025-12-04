// Escalation Configuration
// Define keywords, thresholds, and rules for escalation triggers

export const escalationConfig = {
    // Confidence threshold for AI responses (0-1)
    confidenceThreshold: 0.5,

    // Maximum failed attempts before escalation
    maxFailedAttempts: 3,

    // Escalation keywords by category
    keywords: {
        // User requesting human assistance
        userRequest: [
            'human', 'agent', 'person', 'real person', 'talk to someone',
            'representative', 'customer service', 'support', 'speak to',
            'connect me', 'transfer me', 'live chat', 'live agent',
            'speak to doctor', 'talk to doctor', 'real doctor',
            'speak to nurse', 'talk to nurse', 'escalate', 'supervisor'
        ],

        // Emergency keywords (RED FLAGS) - Always escalate with highest priority
        emergency: [
            // Severe symptoms
            'severe pain', 'severe headache', 'unbearable pain',
            'bleeding', 'vomiting blood', 'blood in stool', 'blood in urine',
            'unconscious', 'passed out', 'fainted', 'collapsed',
            'cannot breathe', 'difficulty breathing', 'can\'t breathe', 'gasping',
            'convulsing', 'seizure', 'fits', 'shaking uncontrollably',

            // Poisoning and accidents
            'poisoning', 'poisoned', 'overdose',
            'accident', 'injured', 'trauma', 'hit by',

            // Stroke and cardiac
            'stroke', 'paralyzed', 'can\'t move', 'face drooping',
            'chest pain', 'heart attack',

            // Pregnancy emergencies
            'pregnancy bleeding', 'bleeding pregnant', 'miscarriage',
            'labor pain', 'contractions',

            // High fever
            'high fever for days', 'fever won\'t go down', 'very high temperature'
        ],

        // Clinical complexity keywords (ORANGE FLAGS) - Requires higher medical expertise
        clinicalComplexity: [
            // Diagnosis requests
            'diagnosis', 'diagnose', 'what disease', 'what illness',
            'what do i have', 'what\'s wrong with me',

            // Lab and imaging
            'interpret my lab', 'lab result', 'blood test result',
            'x-ray result', 'scan result', 'ultrasound result',
            'ct scan', 'mri result',

            // Medication
            'drug dosage', 'how much medication', 'prescription',
            'side effects', 'drug interaction',
            'what medicine should i take', 'which drug',

            // Treatment
            'treatment plan', 'how to treat', 'cure for',
            'medical clearance', 'fit to work'
        ],

        // Policy/System keywords (BLUE FLAGS) - Requires supervisor/admin level
        policySystem: [
            // Guidelines and policies
            'national guideline', 'mohs policy', 'ministry of health',
            'who guideline', 'protocol',

            // Surveillance and reporting
            'surveillance', 'disease reporting', 'notifiable disease',
            'outbreak data', 'epidemic',

            // Facility management
            'supervision checklist', 'facility reporting',
            'quality assurance', 'monitoring and evaluation'
        ],

        // Symptom keywords - Requires health worker or above
        symptoms: [
            'symptom', 'sick', 'ill', 'pain', 'ache',
            'fever', 'cough', 'headache', 'diarrhea',
            'vomiting', 'nausea', 'rash', 'swelling',
            'weakness', 'fatigue', 'dizzy', 'malaria',
            'cholera', 'typhoid', 'ebola', 'lassa fever'
        ],

        // Urgency indicators (kept from original)
        urgency: [
            'urgent', 'emergency', 'asap', 'immediately', 'help now',
            'critical', 'important', 'right now', 'quickly', 'fast'
        ],

        // Complaint/dissatisfaction (kept from original)
        complaint: [
            'complaint', 'complain', 'unhappy', 'dissatisfied', 'disappointed',
            'terrible', 'awful', 'worst', 'horrible', 'useless', 'bad service',
            'not working', 'doesn\'t work', 'broken', 'frustrated', 'angry'
        ],

        // Safety/risk keywords (enhanced for health context)
        safety: [
            'suicide', 'kill myself', 'end my life', 'want to die',
            'abuse', 'violence', 'threat', 'harm', 'danger',
            'legal action', 'lawyer', 'sue', 'court',
            'emergency', 'ambulance', 'police', 'help me',
            'mental health crisis', 'hurt myself', 'harm myself'
        ],

        // Frustration indicators (kept from original)
        frustration: [
            'you don\'t understand', 'not helping', 'this doesn\'t work',
            'not answering', 'wrong answer', 'stupid', 'useless bot',
            'waste of time', 'give up', 'forget it'
        ]
    },

    // Priority mapping based on trigger type
    priorityMapping: {
        safety: 'urgent',
        emergency: 'urgent',
        clinicalComplexity: 'high',
        policySystem: 'normal',
        symptoms: 'normal',
        userRequest: 'high',
        urgency: 'high',
        complaint: 'normal',
        lowConfidence: 'normal',
        failedIntent: 'normal',
        frustration: 'high',
        manual: 'normal'
    },

    // Auto-response templates
    responses: {
        escalated: "I understand this is important. I've flagged your message for our team to review. A human agent will get back to you as soon as possible.",
        safety: "I can see this is urgent. I'm connecting you with someone who can help right away. Please hold on.",
        emergency: "This appears to be an emergency situation. I am escalating this immediately to a medical professional. Please also consider going to the nearest health facility or calling emergency services.",
        clinicalComplexity: "This question requires advanced clinical expertise. I am escalating this to a medical expert for proper guidance.",
        policySystem: "This question involves policy or system-level information. I am escalating this to a supervisor for accurate guidance.",
        symptoms: "This issue requires a health worker. I will escalate your request to a trained health staff member.",
        userRequest: "Of course! I'm transferring you to a human agent who can assist you better. They'll be with you shortly.",
        urgency: "I understand this is urgent. I've prioritized your request and our team will respond as quickly as possible."
    },

    // Enable/disable specific triggers
    triggers: {
        keywords: true,
        lowConfidence: true,
        failedIntent: true,
        userBehavior: true,
        safety: true,
        emergency: true,
        clinicalComplexity: true,
        policySystem: true,
        symptoms: true
    }
};

// Helper function to check if message contains escalation keywords
export function detectEscalationKeywords(message: string): {
    triggered: boolean;
    category: string | null;
    matchedKeywords: string[];
} {
    const lowerMessage = message.toLowerCase();

    // Check emergency keywords first (highest priority for health)
    for (const keyword of escalationConfig.keywords.emergency) {
        if (lowerMessage.includes(keyword.toLowerCase())) {
            return {
                triggered: true,
                category: 'emergency',
                matchedKeywords: [keyword]
            };
        }
    }

    // Check safety keywords (second highest priority)
    for (const keyword of escalationConfig.keywords.safety) {
        if (lowerMessage.includes(keyword.toLowerCase())) {
            return {
                triggered: true,
                category: 'safety',
                matchedKeywords: [keyword]
            };
        }
    }

    // Check clinical complexity keywords
    const clinicalMatched = escalationConfig.keywords.clinicalComplexity.filter(keyword =>
        lowerMessage.includes(keyword.toLowerCase())
    );
    if (clinicalMatched.length > 0) {
        return {
            triggered: true,
            category: 'clinicalComplexity',
            matchedKeywords: clinicalMatched
        };
    }

    // Check policy/system keywords
    const policyMatched = escalationConfig.keywords.policySystem.filter(keyword =>
        lowerMessage.includes(keyword.toLowerCase())
    );
    if (policyMatched.length > 0) {
        return {
            triggered: true,
            category: 'policySystem',
            matchedKeywords: policyMatched
        };
    }

    // Check symptom keywords
    const symptomMatched = escalationConfig.keywords.symptoms.filter(keyword =>
        lowerMessage.includes(keyword.toLowerCase())
    );
    if (symptomMatched.length > 0) {
        return {
            triggered: true,
            category: 'symptoms',
            matchedKeywords: symptomMatched
        };
    }

    // Check other categories
    const categories = ['userRequest', 'urgency', 'complaint', 'frustration'];
    for (const category of categories) {
        const keywords = escalationConfig.keywords[category as keyof typeof escalationConfig.keywords];
        if (Array.isArray(keywords)) {
            const matched = keywords.filter(keyword =>
                lowerMessage.includes(keyword.toLowerCase())
            );
            if (matched.length > 0) {
                return {
                    triggered: true,
                    category,
                    matchedKeywords: matched
                };
            }
        }
    }

    return {
        triggered: false,
        category: null,
        matchedKeywords: []
    };
}

// Helper function to determine priority
export function getEscalationPriority(triggerType: string): string {
    return escalationConfig.priorityMapping[triggerType as keyof typeof escalationConfig.priorityMapping] || 'normal';
}

// Helper function to get appropriate response
export function getEscalationResponse(category: string): string {
    return escalationConfig.responses[category as keyof typeof escalationConfig.responses]
        || escalationConfig.responses.escalated;
}
