## ADDED Requirements

### Requirement: Published Quiz Listing
The system SHALL provide a paginated endpoint returning published quizzes shaped for a card grid: title, author username, question count, tags, and play count.

#### Scenario: Default listing returns published quizzes only
- **WHEN** a client (authenticated or not) requests the published quiz listing with no filters
- **THEN** the server returns a page of quizzes whose status is `published`, each including title, author username, question count, tags, and play count, and no draft quiz appears

#### Scenario: Listing is paginated
- **WHEN** a client requests the published quiz listing with a page and limit
- **THEN** the server returns at most `limit` quizzes for that page, drawn from the full set of published quizzes

### Requirement: Keyword Search
The system SHALL allow filtering the published quiz listing by a keyword matched against quiz title.

#### Scenario: Search matches title
- **WHEN** a client requests the published quiz listing with a search keyword that appears in some published quizzes' titles
- **THEN** the server returns only published quizzes whose title matches the keyword

#### Scenario: Search matching nothing returns an empty page
- **WHEN** a client searches for a keyword that matches no published quiz title
- **THEN** the server returns an empty result set, not an error

### Requirement: Tag Filtering (Match Any)
The system SHALL allow filtering the published quiz listing by one or more tags, returning quizzes that have at least one of the given tags.

#### Scenario: Single tag filter
- **WHEN** a client requests the published quiz listing filtered by one tag
- **THEN** the server returns only published quizzes tagged with that tag

#### Scenario: Multiple tags use match-any semantics
- **WHEN** a client requests the published quiz listing filtered by more than one tag
- **THEN** the server returns every published quiz that has at least one of the given tags, including quizzes that match only one of them

### Requirement: Sorting by Popularity or Recency
The system SHALL support sorting the published quiz listing by play count descending (`popular`) or by creation recency (`newest`, the default), and SHALL allow this sort to combine with search and tag filtering.

#### Scenario: Default sort is newest
- **WHEN** a client requests the published quiz listing without specifying a sort
- **THEN** the server returns results ordered by most recently created first

#### Scenario: Popular sort orders by play count
- **WHEN** a client requests the published quiz listing with `sort=popular`
- **THEN** the server returns results ordered by play count descending

#### Scenario: Sort combines with search and tag filters
- **WHEN** a client requests the published quiz listing with a search keyword, one or more tags, and a sort order together
- **THEN** the server applies the keyword filter and the tag filter before applying the requested sort order

### Requirement: Tag Catalog
The system SHALL provide an endpoint listing all existing tags, for use in filter UI.

#### Scenario: Client lists all tags
- **WHEN** any client requests the tag catalog
- **THEN** the server returns every existing tag

### Requirement: Case-Insensitive Tag Deduplication on Write
The system SHALL lowercase and trim a tag before looking it up or inserting it, and SHALL reuse an existing tag row that matches case-insensitively rather than creating a duplicate.

#### Scenario: New tag is stored lowercase
- **WHEN** an author adds a tag with mixed-case or surrounding whitespace (e.g. " Math ")
- **THEN** the server stores it trimmed and lowercased (e.g. "math")

#### Scenario: Adding a tag that differs only by case reuses the existing tag
- **WHEN** an author adds a tag whose lowercase form already exists as a tag (e.g. adding "MATH" when "math" already exists)
- **THEN** the server associates the quiz with the existing "math" tag rather than creating a second tag row

### Requirement: Public Browsing Without Authentication
The system SHALL allow browsing, searching, filtering, and sorting the published quiz listing and tag catalog without authentication.

#### Scenario: Unauthenticated client browses the library
- **WHEN** a client with no authentication requests the published quiz listing, applies search/tag/sort options, or requests the tag catalog
- **THEN** the server serves the request normally, identical to an authenticated request
