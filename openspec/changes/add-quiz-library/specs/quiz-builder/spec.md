## ADDED Requirements

### Requirement: Author Tag Management
The system SHALL allow a quiz's author to add and remove tags on that quiz (in either `draft` or `published` status), reusing the same case-insensitive tag deduplication applied to every tag write, and SHALL reject tag changes from anyone but the quiz's author.

#### Scenario: Author adds a tag to their quiz
- **WHEN** the quiz's author submits a tag to add to their quiz
- **THEN** the server associates that tag with the quiz, creating the tag if it does not already exist (case-insensitively)

#### Scenario: Author removes a tag from their quiz
- **WHEN** the quiz's author requests removal of a tag currently associated with their quiz
- **THEN** the server removes that association; the tag itself remains available for other quizzes

#### Scenario: Non-author attempts to change tags
- **WHEN** an authenticated client that is not the quiz's author attempts to add or remove a tag on that quiz
- **THEN** the server rejects the request and makes no change

#### Scenario: Tags can be added regardless of draft or published status
- **WHEN** the quiz's author adds a tag to a quiz that is currently `draft` or currently `published`
- **THEN** the server accepts the tag addition in either status
