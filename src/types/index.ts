export type CallStatus = 'queued' | 'scheduled' | 'in_progress' | 'completed' | 'failed'
export type UserRole = 'staff' | 'admin' | 'superadmin'
export type VerificationType = 'diagnostic' | 'hearing_aid' | 'abr' | 'apd' | 'vestibular'

export interface Clinic {
  id: string
  name: string
  address: string | null
  npi: string | null
  tax_id: string | null
  callback_number: string | null
  vendor_contracts: string[] | null
  biller_phone: string | null
  features: Record<string, boolean> | null
  status: 'active' | 'inactive'
  created_at: string
}

export interface Profile {
  id: string
  clinic_id: string | null
  role: UserRole
  full_name: string | null
  email: string | null
}

export interface Template {
  id: string
  clinic_id: string
  name: string
  codes_requested: string
  created_at: string
}

export interface Call {
  id: string
  vapi_call_id: string | null
  clinic_id: string
  patient_name: string
  dob: string
  member_id: string
  provider_npi: string | null
  clinic_tax_id: string | null
  clinic_name: string | null
  clinic_address: string | null
  insurance_phone: string
  codes_requested: string
  phone_number_id: string | null
  callback_number: string | null
  // Verification template fields
  verification_type: VerificationType | null
  date_of_service: string | null
  plan_type: string | null
  state: string | null
  diagnosis_code: string | null
  subscriber_name: string | null
  subscriber_dob: string | null
  status: CallStatus
  channel: string | null // electronic | autonomous_call | hybrid_call | carve_out_refer | needs_setup
  scheduled_for: string | null
  structured_output_eligibility: EligibilityOutput | null
  structured_output_codes: CodesOutput | null
  transcript: string | null
  recording_url: string | null
  duration_seconds: number | null
  ended_reason: string | null
  cost: number | null // real Vapi phone-call cost (from webhook)
  electronic_checks: number | null // billable Stedi transactions
  electronic_cost: number | null // estimated Stedi cost for this verification
  created_at: string
  updated_at: string
  started_at: string | null
  ended_at: string | null
}

export type ClaimStatus = 'unchecked' | 'paid' | 'denied' | 'pending' | 'acknowledged' | 'not_found' | 'error'

export interface Claim {
  id: string
  clinic_id: string
  patient_name: string
  patient_dob: string | null
  gender: string | null
  member_id: string
  payer_stedi_id: string
  payer_name: string | null
  service_date_from: string
  service_date_to: string | null
  charge_amount: number | null
  status: ClaimStatus
  status_detail: string | null
  paid_amount: number | null
  payer_claim_number: string | null
  last_checked_at: string | null
  // Submission (837P)
  diagnosis_codes: string[] | null
  service_lines: ServiceLineItem[] | null
  place_of_service: string | null
  submission_status: 'draft' | 'submitted' | 'accepted' | 'rejected' | 'error' | null
  claim_control_number: string | null
  submitted_at: string | null
  submission_detail: string | null
  created_at: string
  updated_at: string
}

export interface ServiceLineItem {
  procedureCode: string
  modifiers?: string[]
  chargeAmount: number
  units: number
  serviceDate: string
}

export interface EligibilityOutput {
  member: {
    patientName: string
    dob: string
    memberId: string
    gender?: string | null
    address?: string | null
    groupNumber?: string | null
    groupName?: string | null // employer / group sponsor
    coverageLevel?: string | null
    eligibilityStatus?: string | null
    eligibilityEffectiveDate?: string | null
    eligibilityEndDate?: string | null
  }
  plan?: {
    planName?: string | null
    planType?: string | null
    payerName?: string | null
    networkName?: string | null
    insuranceType?: string | null // e.g. Medicare Supplement / Other — COB signal
    pcpRequired?: boolean | null
    referralRequired?: boolean | null
    priorAuthRequired?: boolean | null
    priorAuthPhone?: string | null // utilization-management contact
    isInNetworkVerified?: boolean | null
    medicalNecessityRequired?: boolean | null
    fundingType?: string | null
  }
  // Coordination of benefits — who pays first. Critical for Medicare-age audiology.
  coordinationOfBenefits?: {
    primaryPayer?: string | null
    primaryPolicyNumber?: string | null
    isSecondary?: boolean | null
    note?: string | null
  } | null
  benefits?: {
    benefitPeriod?: string | null
    // Visit / quantity limits (e.g. "20 chiro visits / yr"), payer-dependent.
    limitations?: Array<{ service: string; cap?: string | null; remaining?: string | null; note?: string | null }>
    // Services the plan explicitly does NOT cover.
    exclusions?: string[]
    deductible?: {
      individualTotal?: number | null
      individualRemaining?: number | null
      familyTotal?: number | null
      familyRemaining?: number | null
      appliesToAudiology?: boolean | null
    }
    outOfPocketMax?: {
      individualTotal?: number | null
      individualRemaining?: number | null
      familyTotal?: number | null
      familyRemaining?: number | null
    }
    coinsurance?: {
      inNetworkPercent?: number | null
      outOfNetworkPercent?: number | null
    }
    copays?: {
      hearingExam?: number | null
      audiologyVisit?: number | null
      specialistVisit?: number | null
    }
    audiologyExam?: {
      covered?: boolean | null
      visitLimit?: string | null
      frequencyLimit?: string | null
      coverageDetails?: string | null
      codesMentioned?: string[] | null
    }
    hearingAidBenefit?: {
      covered?: boolean | null
      frequency?: string | null
      allowanceAmount?: number | null
      allowanceType?: string | null
      requiresPriorAuth?: boolean | null
      requiresReferral?: boolean | null
      vendorRestriction?: string | null
      deductibleApplies?: boolean | null
      coinsurancePercent?: number | null
      copayAmount?: number | null
      ageRestrictions?: string | null
      coverageNotes?: string | null
      codesMentioned?: string[] | null
      benefitStructure?: string | null
      benefitStillAvailable?: boolean | null
      benefitLastUsedDate?: string | null
      priorAuthPhone?: string | null
    }
    earMoldsAccessories?: {
      covered?: boolean | null
      details?: string | null
    }
    outOfNetwork?: {
      coverageDifferent?: boolean | null
      details?: string | null
    }
  }
  provider?: {
    providerNPI?: string | null
    clinicTaxId?: string | null
    providerName?: string | null
    providerInNetworkStatus?: string | null
  }
  callReference?: {
    repName?: string | null
    department?: string | null
    callReferenceNumber?: string | null
    repReferenceId?: string | null
    callTimestamp?: string | null
  }
  confidence?: 'high' | 'medium' | 'low' | null
  notes?: string | null
  outcome?: {
    status?: 'benefits_captured' | 'redirected' | 'not_covered' | 'needs_callback' | 'incomplete' | null
    nextAction?: string | null
    redirectPhone?: string | null
    redirectReason?: string | null
  } | null
}

export interface CodesOutput {
  member: {
    patientName: string
    dob: string
    memberId: string
    groupNumber?: string | null
  }
  codesRequested?: string | null
  requestedCodes: Array<{
    code: string
    covered?: boolean | null
    priorAuthRequired?: boolean | null
    referralRequired?: boolean | null
    deductibleApplies?: boolean | null
    coinsurance?: string | null
    copay?: string | null
    frequencyLimits?: string | null
    dollarCaps?: string | null
    networkRestrictions?: string | null
    notes?: string | null
  }>
  provider?: {
    providerNPI?: string | null
    clinicTaxId?: string | null
    providerInNetworkStatus?: string | null
  }
  callReference?: {
    repName?: string | null
    department?: string | null
    callReferenceNumber?: string | null
    repReferenceId?: string | null
  }
  confidence?: 'high' | 'medium' | 'low' | null
  notes?: string | null
}
