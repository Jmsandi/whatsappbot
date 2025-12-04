/**
 * Role-Based Access Control Types
 * Defines user roles, permissions, and escalation logic for the Salone Health Intelligence Assistant
 */

/**
 * User roles in the health system
 */
export enum UserRole {
    SUPPORT = 'support',
    HEALTH_WORKER = 'health_worker',
    SUPERVISOR = 'supervisor',
    ADMIN = 'admin'
}

/**
 * Actions that can be performed by different roles
 */
export enum RoleAction {
    // Basic actions
    BASIC_HEALTH_EDUCATION = 'basic_health_education',
    FACILITY_DIRECTIONS = 'facility_directions',
    HYGIENE_TIPS = 'hygiene_tips',

    // Health worker actions
    PUBLIC_HEALTH_GUIDANCE = 'public_health_guidance',
    BASIC_SYMPTOM_EXPLANATION = 'basic_symptom_explanation',
    TRIAGE_PRINCIPLES = 'triage_principles',
    IPC_PRACTICES = 'ipc_practices',

    // Supervisor actions
    DETAILED_PUBLIC_HEALTH = 'detailed_public_health',
    FACILITY_PROTOCOLS = 'facility_protocols',
    OUTBREAK_RESPONSE = 'outbreak_response',
    DATA_INTERPRETATION = 'data_interpretation',

    // Admin actions
    CLINICAL_EXPLANATIONS = 'clinical_explanations',
    DIFFERENTIAL_REASONING = 'differential_reasoning',
    LAB_INTERPRETATION = 'lab_interpretation',
    IMAGING_INTERPRETATION = 'imaging_interpretation',
    TREATMENT_PATHWAYS = 'treatment_pathways',

    // Prohibited actions (for validation)
    MEDICAL_DIAGNOSIS = 'medical_diagnosis',
    MEDICATION_PRESCRIPTION = 'medication_prescription',
    COMPLEX_CLINICAL_DECISIONS = 'complex_clinical_decisions'
}

/**
 * Escalation trigger types
 */
export enum EscalationTrigger {
    EMERGENCY = 'emergency',
    CLINICAL_COMPLEXITY = 'clinical_complexity',
    POLICY_SYSTEM = 'policy_system',
    USER_REQUEST = 'user_request',
    ROLE_LIMITATION = 'role_limitation'
}

/**
 * Escalation priority levels
 */
export enum EscalationPriority {
    CRITICAL = 'critical',
    URGENT = 'urgent',
    HIGH = 'high',
    NORMAL = 'normal'
}

/**
 * Role permission mapping
 */
export const ROLE_PERMISSIONS: Record<UserRole, RoleAction[]> = {
    [UserRole.SUPPORT]: [
        RoleAction.BASIC_HEALTH_EDUCATION,
        RoleAction.FACILITY_DIRECTIONS,
        RoleAction.HYGIENE_TIPS
    ],
    [UserRole.HEALTH_WORKER]: [
        RoleAction.BASIC_HEALTH_EDUCATION,
        RoleAction.FACILITY_DIRECTIONS,
        RoleAction.HYGIENE_TIPS,
        RoleAction.PUBLIC_HEALTH_GUIDANCE,
        RoleAction.BASIC_SYMPTOM_EXPLANATION,
        RoleAction.TRIAGE_PRINCIPLES,
        RoleAction.IPC_PRACTICES
    ],
    [UserRole.SUPERVISOR]: [
        RoleAction.BASIC_HEALTH_EDUCATION,
        RoleAction.FACILITY_DIRECTIONS,
        RoleAction.HYGIENE_TIPS,
        RoleAction.PUBLIC_HEALTH_GUIDANCE,
        RoleAction.BASIC_SYMPTOM_EXPLANATION,
        RoleAction.TRIAGE_PRINCIPLES,
        RoleAction.IPC_PRACTICES,
        RoleAction.DETAILED_PUBLIC_HEALTH,
        RoleAction.FACILITY_PROTOCOLS,
        RoleAction.OUTBREAK_RESPONSE,
        RoleAction.DATA_INTERPRETATION
    ],
    [UserRole.ADMIN]: [
        RoleAction.BASIC_HEALTH_EDUCATION,
        RoleAction.FACILITY_DIRECTIONS,
        RoleAction.HYGIENE_TIPS,
        RoleAction.PUBLIC_HEALTH_GUIDANCE,
        RoleAction.BASIC_SYMPTOM_EXPLANATION,
        RoleAction.TRIAGE_PRINCIPLES,
        RoleAction.IPC_PRACTICES,
        RoleAction.DETAILED_PUBLIC_HEALTH,
        RoleAction.FACILITY_PROTOCOLS,
        RoleAction.OUTBREAK_RESPONSE,
        RoleAction.DATA_INTERPRETATION,
        RoleAction.CLINICAL_EXPLANATIONS,
        RoleAction.DIFFERENTIAL_REASONING,
        RoleAction.LAB_INTERPRETATION,
        RoleAction.IMAGING_INTERPRETATION,
        RoleAction.TREATMENT_PATHWAYS
    ]
};

/**
 * Role escalation targets
 */
export const ROLE_ESCALATION_TARGET: Record<UserRole, UserRole | null> = {
    [UserRole.SUPPORT]: UserRole.HEALTH_WORKER,
    [UserRole.HEALTH_WORKER]: UserRole.SUPERVISOR,
    [UserRole.SUPERVISOR]: UserRole.ADMIN,
    [UserRole.ADMIN]: null // Admin is top level, no escalation
};

/**
 * Role display names
 */
export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
    [UserRole.SUPPORT]: 'Support Staff',
    [UserRole.HEALTH_WORKER]: 'Health Worker',
    [UserRole.SUPERVISOR]: 'Supervisor',
    [UserRole.ADMIN]: 'Admin/Clinical Expert'
};

/**
 * Role descriptions
 */
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
    [UserRole.SUPPORT]: 'Non-medical staff providing basic health education and facility information',
    [UserRole.HEALTH_WORKER]: 'Frontline medical assistant with basic clinical knowledge',
    [UserRole.SUPERVISOR]: 'Program coordinator and facility-level decision maker',
    [UserRole.ADMIN]: 'Advanced medical practitioner and senior clinical decision-maker'
};

/**
 * Validate if a role string is a valid UserRole
 */
export function isValidRole(role: string): role is UserRole {
    return Object.values(UserRole).includes(role as UserRole);
}

/**
 * Get the next escalation target for a given role
 */
export function getEscalationTarget(currentRole: UserRole): UserRole | null {
    return ROLE_ESCALATION_TARGET[currentRole];
}

/**
 * Check if a role can perform a specific action
 */
export function canPerformAction(role: UserRole, action: RoleAction): boolean {
    return ROLE_PERMISSIONS[role].includes(action);
}

/**
 * Get all capabilities for a role
 */
export function getRoleCapabilities(role: UserRole): RoleAction[] {
    return ROLE_PERMISSIONS[role];
}

/**
 * Parse role from string with fallback to default
 */
export function parseRole(roleString: string | undefined, defaultRole: UserRole = UserRole.SUPPORT): UserRole {
    if (!roleString) {
        return defaultRole;
    }

    if (isValidRole(roleString)) {
        return roleString as UserRole;
    }

    return defaultRole;
}
