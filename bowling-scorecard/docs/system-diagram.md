# Bowling Scorecard Vibes — System Diagram

```mermaid
flowchart TD
    subgraph Browser["React Browser App"]
        App[App.tsx]
        Scorecard[Scorecard.tsx<br/>FrameBox.tsx]
        DisplayHelpers[displayHelpers.ts]
        RandomGen[gameGenerator.ts]
        OCR[scoreExtractor.ts]
    end

    subgraph LLMVendors["External LLM APIs"]
        Claude["Anthropic Claude<br/>(claudeExtractor.ts)"]
        OpenAI["OpenAI Vision<br/>(openaiExtractor.ts)"]
    end

    App -- initial load --> InitChoice{REACT_APP_ENABLE_AUTO_TEST_IMAGE?}
    InitChoice -- "true" --> AutoLoad[Test image fetch<br/>/test-scorecard.jpg]
    InitChoice -- "false" --> RandomGen

    AutoLoad --> OCR
    App -- "Generate New Game" --> RandomGen
    App -- "User uploads image" --> OCR

    RandomGen --> Scorecard
    OCR --> Claude & OpenAI
    Claude & OpenAI --> OCR
    OCR --> App
    App --> Scorecard --> DisplayHelpers --> Scorecard

    style Browser fill:#f0f5ff,stroke:#1d4ed8,stroke-width:2px
    style LLMVendors fill:#fff7ed,stroke:#ea580c,stroke-width:2px
```
