# CARD DATA SCHEMA

Use JSON or equivalent structured data.

Example:

{
  "id": "BT01-001",
  "name": "Example Unit",
  "set": "BT01",
  "grade": 3,
  "power": 10000,
  "shield": 0,
  "critical": 1,
  "clan": "Royal Paladin",
  "race": "Human",
  "type": "Normal Unit",
  "trigger": null,
  "text": "...",
  "abilities": [
    {
      "id": "BT01-001-01",
      "timing": "ACT",
      "conditions": [],
      "costs": [],
      "effects": []
    }
  ],
  "image": "cards/BT01/BT01-001.webp",
  "legality": {
    "BT01_BT17": true
  }
}

## Rules

- IDs must be unique.
- Card names must be preserved accurately.
- Stats must be typed.
- Trigger type must be enum/null.
- Grade must be numeric.
- Abilities must reference generic engine effects where possible.
- Images are assets, not data truth.
- Historical errata must be represented explicitly.
