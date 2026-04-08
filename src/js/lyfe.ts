interface StringValue<T extends string = string> {
  value: T
  source: DatapointSource
}

interface NumericValue {
  value: number
  source: DatapointSource
}

interface DateValue {
  value: Date
  source: DatapointSource
}

interface Person {
  id: string
  label: StringValue

  first_name?: StringValue
  middle_name?: StringValue
  last_name?: StringValue
  maiden_name?: StringValue

  gender?: StringValue<'male' | 'female' | 'non-binary'>

  birthday?: Birthday

  personas: Persona[]
  interactions: Interaction[]

  source: DatapointSource
  notes: Note[]
}

interface ContactMethodBase {
  id: string
  /** the persona associated with this  */
  persona: Persona
  start?: DateValue
  end?: DateValue
  /** the importance / preference level for this contact method, the lower the more important, 0 = absolute favorite, 5 = favorite for medium, 10+ = only use in response  */
  priority?: NumericValue
  notes: Note[]
}

interface ContactMethodPhone extends ContactMethodBase {
  kind: 'phone'
  number: StringValue
}

interface ContactMethodEmail extends ContactMethodBase {
  kind: 'email'
  address: StringValue
}

interface ContactMethodPhysical extends ContactMethodBase {
  kind: 'physical'
  address: PhysicalAddress
}

interface ContactMethodApp extends ContactMethodBase {
  kind: 'app'
  app: ContactApp
  /** the fully qualified + opaque (numeric or UUID-like) identifier in the corresponding system  */
  user_id?: StringValue
  /** the user-friendly identifier in the corresponding system */
  username?: StringValue
}

interface ContactApp {
  id: string
  /** Friendly, recognizable name for the app, e.g. "Slack (Netflix)" */
  name: string
  /** URL where the contact app can be used, base origin preferred if that's sufficient, path if disambiguation is needed */
  url?: string
}

type ContactMethod =
  | ContactMethodPhone
  | ContactMethodEmail
  | ContactMethodPhysical
  | ContactMethodApp

interface PersonaBase {
  id: string
  start?: Date
  end?: Date
  relationship:
    | 'self'
    | 'significant-other'
    | 'fiancee'
    | 'spouse'
    | 'parent'
    | 'parent-in-law'
    | 'sibling'
    | 'sibling-in-law'
    | 'cousin'
    | 'grandparent'
    | 'child'
    | 'grandchild'
    | 'aunt-uncle'
    | 'relative'
    | 'friend'
    | 'neighbor'
    | 'coworker'
    | 'client'
    | 'donor'
    | 'vendor'
    | 'teacher'
    | 'partner'
    | 'mentee'
    | 'mentor'
    | 'acquaintence'
  /** The strength of the relationship _RELATIVE TO THE EXPECTED FOR IT'S KIND_. e.g. a "weak" parent relationship is probably still stronger than a "strong" work-vendor relationship */
  strength?: 'very-strong' | 'strong' | 'moderate' | 'weak' | 'non-existent'
  /** the contact methods associated with this persona, note that the same contact method might be reused across personas */
  contact_methods: ContactMethod[]
  notes: Note[]
}

interface PersonaPersonal extends PersonaBase {
  kind: 'personal'
}

interface PersonaProfessional extends PersonaBase {
  kind: 'professional'
  title?: string
  company?: string
  /** answers "this person was _____ to me" */
  seniority?: 'peer' | 'junior' | 'senior'
}

type Persona = PersonaPersonal | PersonaProfessional

interface ExactBirthday {
  kind: 'exact'
  year: number
  month: number
  day: number
  source: DatapointSource
}

interface ApproximateBirthday {
  kind: 'approximate'
  /** Rough year the person was born, if known. If exact year, month, and day are known, use ExactBirthday */
  year?: NumericValue
  /** The approximate month the person was born, if known. */
  month?: NumericValue
  /** The approximate day of the month the person was born, if known. */
  day?: NumericValue
  notes: Note[]
}

type Birthday = ExactBirthday | ApproximateBirthday

interface RawDataItem {
  source: DatapointSourceExternalEntity
  content: Uint8Array
  fetched_at: Date
}

interface RawContact {
  label: string
  first_name?: string
  last_name?: string
  email?: string
  phone?: string
  address_line_1?: string
  address_line_2?: string
  address_city?: string
  address_state?: string
  address_zipcode?: string
  address_country?: string
  username?: string
  contact_app_id?: string
  contact_app_name?: string
  usage?: 'personal' | 'professional'
  birthday?: string
  webpage?: string
  notes: Note[]
  source: DatapointSource
}

interface RawInteraction {
  kind: 'text' | 'phone' | 'video' | 'in-person'
  contact: RawContact
  /** ISO 8601 - YYYY-MM-DDThh:mm:ssZ */
  started_at?: string
  /** ISO 8601 - YYYY-MM-DDThh:mm:ssZ */
  ended_at?: string
  content?: string
  attachments?: Array<{url: string; caption?: string; filename?: string}>
  notes: Note[]
  source: DatapointSource
}

interface PhysicalAddress {
  label?: StringValue
  line_1?: StringValue
  line_2?: StringValue
  city: StringValue
  state?: StringValue
  zipcode?: StringValue
  /** Two-letter country code */
  country: StringValue
}

interface InteractionBase {
  id: string
  notes: Note[]
  source: DatapointSource
}

interface InteractionDurationBase extends InteractionBase {
  started_at: Date
  ended_at: Date
}

interface InteractionText extends InteractionBase {
  kind: 'text'
  thread: TextThread
  contact_method: ContactMethod
  timestamp: Date
  content: string
  attachments: Array<FileReference>
}

interface TextThread {
  id: string
  label?: string
  contact_method: ContactMethod
  notes: Note[]
  source: DatapointSource
}

interface InteractionPhone extends InteractionDurationBase {
  kind: 'phone'
  contact_method: ContactMethod
}

interface InteractionVideo extends InteractionDurationBase {
  kind: 'video'
  contact_method: ContactMethod
  started_at: Date
  ended_at: Date
}

interface InteractionInPerson extends InteractionDurationBase {
  kind: 'in-person'
  started_at: Date
  ended_at: Date
  location?: PhysicalAddress
}

type Interaction = InteractionText | InteractionPhone | InteractionVideo | InteractionInPerson

interface DatapointSourceExternalEntity {
  // This class is for data that is just directly sourced from another external entity, no inference / synthetic creation at all
  // e.g. a contact which is also a contact entity in the CRM / Google Contacts
  kind: 'external-entity'
  entity: ExternalMetadata
}

interface DatapointSourceInferred {
  /** This class is for data which was NOT sourced directly from an external system, but inferred in some way */
  // default = there was no other data used at all, it was just assumed by the system
  //    (e.g. country = US if not provided)
  // heuristic = there was deterministic code that looked at some data and made an educated guess
  //    (e.g. country code +1 in phone number if country = US)
  //    (e.g. person.first_name = label.split(" ")[0])
  //    (e.g. person.label = prefer Google Contacts label field, fallback to firstname + lastname)
  // llm = an LLM was given some context and asked to provide / dedupe this data
  //    (e.g. here are all of the labels for this person across different systems, which should we use?)
  kind: 'default' | 'heuristic' | 'llm'
  sources: DatapointSource[]
  explanation: string
}

type DatapointSource = DatapointSourceExternalEntity | DatapointSourceInferred

enum PersonNoteCategory {
  CLOTHING,
  LIKES,
  DISLIKES,
  EMPLOYMENT,
  PETS,
  OTHER,
}

interface PersonNote {
  kind: 'person'
  subject: Person
  category: PersonNoteCategory
  source: DatapointSource
  content: string
}

type Note = PersonNote

interface FileReference {
  id: string
  mime_type?: string
  url: string
  caption?: string
  notes: Note[]
}

// ------- DATA SOURCES

enum RawDataKind {
  CONTACT,
  INTERACTION,
}

enum RecordKind {
  PEOPLE,
  CONTACT_METHODS,
  INTERACTIONS,
  THREADS,
}

interface DataProvider {
  /** autogenerated nanoId */
  id: string
  /** User-configured, identifable name for the data provider, e.g. "Gmail - Browser" or "Email - POP3" */
  label: string
  /** The lyfe plugin ID used to fetch the data, */
  source: PluginWithOptions
  /** The post-processors to augment the raw data pulled from the source (e.g. the raw connector pulls phone data, maybe the post-processor googles the number to look up a business listing) */
  processors: PluginWithOptions[]
  /** The list of contact applications data which are sourced by this provider (e.g. a single slack API provider which pulls data for all connect accounts) */
  contact_apps: ContactApp[]
}

interface PluginWithOptions {
  /** Personal ID of this configured plugin instance (another nanoid) */
  id: string
  /** Unique identifier for the plugin code in the Lyfe ecosystem,  e.g. 'lyfe-plugin-contact-pop3' */
  name: string
  /** Friendly name for the plugin */
  label: string
  /** The types of data that this plugin should provide */
  enabled_ingress: Array<RawDataKind | RecordKind>
  /** Configured options for the plugin, user-provided */
  options: Record<string, unknown>
  /** Latest state of the plugin that it manages, plugin-provided */
  state: Record<string, unknown>
}

interface ExternalMetadata {
  /** The unique, autogenerated ID of the data provider from which this came */
  provider_id: string
  /** A unique machine-centric identifier for this entity in the context of that data provider (e.g. a UUID) */
  identifier?: string
  /** A unique, user-centric identifier for this entity in the context of that data provider (e.g. a username) */
  friendly_identifier?: string
  /** A unique, helpful URL for this entity in another provider */
  url?: string
  /** Any additional metadata that may be helpful for this provider to trace the lineage */
  extended?: Map<string, unknown>
  /** The time at which this entity was last updated at the external provider */
  updated_at?: Date
}

/**
 *
 * User flow
 *  - Create account
 *  - Connects Google Contacts, Gmail, and Messages
 *  - Cron
 *      - Contact
 *          - Ingest
 *             - For each provider, check date since last ingest, ask for dump since that date
 *             - They will dump in the RawDataItem + GenericRawContact / GenericRawInteractions
 *             - Run `processors` associated with each provider which accept an interface to the current DB of data plus the new data, output is still GenericRaw*
 * NOTE!: string repalcements are just a configured processor
 * NOTE!: default processor just de-dupes based on the external ID / hashed timestamp + content, updated_at date as available
               - now we have every individual connector's new data
 *          - People
 *              - Run system-level postprocessors
*                   - Generate synthetic people from interactions in heuristic fashion (e.g. if there was an interaction without contact concept, generate a standalone contact record)
*                   - Deterministically map from the flat / generic structure to the nested one
*                   - Look up existing person for the given external ID source data (if exists)
*                   - if nothing, look up existing persons with heuristics (first + last name, email, phone number, etc)
*                   - if still nothing, just use the record directly
 *              - Now we have a list of actual people objects, time to merge
 *              - commit the updates to people (update data based on data provider priority, create new people as needed)
 *          - Threads
 *              - Generate synthetic threads from interactions in heuristic fashion
 *              - Threads are always connector specific, so no deduping
 *              - Now we have a list of actual thread objects, time to merge
 *          - Interactions
 *              -
 *
 *
 * USE CASE: we want interactions to be tied to contact methods so that if a contact method ever moves from person to person (accidental dedupe) we can keep the chain in line
 * USE CASE: set priority of data providers so we have heuristics to know whether to update data when it comes in, e.g. the "explanation" fiedl of data source can say things like "The Provider1 field was preferred over Provider2 field due to priority level blah."
 */
