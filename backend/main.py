from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import json
import os
from openai import OpenAI
from dotenv import load_dotenv

# Chargement des variables d'environnement
load_dotenv()

app = FastAPI()

# Configuration CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration OpenAI
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Modèles de données
class UserResponse(BaseModel):
    question_id: int
    answer: str

# Questions génériques initiales
GENERIC_QUESTIONS = {
    1: {
        "id": 1,
        "text": "Dans quel type d'activité te sens-tu le plus à l'aise ?",
        "options": [
            {"id": "creative", "text": "Les activités créatives et artistiques"},
            {"id": "technical", "text": "Les activités techniques et logiques"},
            {"id": "social", "text": "Les activités sociales et relationnelles"},
            {"id": "practical", "text": "Les activités pratiques et concrètes"}
        ]
    },
    2: {
        "id": 2,
        "text": "Qu'est-ce qui te motive le plus dans un projet ?",
        "options": [
            {"id": "impact", "text": "Avoir un impact positif sur les autres"},
            {"id": "challenge", "text": "Relever des défis et progresser"},
            {"id": "freedom", "text": "Avoir de la liberté et de l'autonomie"},
            {"id": "create", "text": "Créer et innover"}
        ]
    },
    3: {
        "id": 3,
        "text": "Comment préfères-tu travailler ?",
        "options": [
            {"id": "team", "text": "En équipe, avec beaucoup d'interactions"},
            {"id": "solo", "text": "Seul(e), de manière autonome"},
            {"id": "mix", "text": "Un mélange des deux selon les situations"},
            {"id": "lead", "text": "En guidant et en dirigeant les autres"}
        ]
    },
    4: {
        "id": 4,
        "text": "Quel environnement te correspond le mieux ?",
        "options": [
            {"id": "dynamic", "text": "Un environnement dynamique et changeant"},
            {"id": "stable", "text": "Un cadre stable et bien structuré"},
            {"id": "flexible", "text": "Un environnement flexible et adaptable"},
            {"id": "outdoor", "text": "Un environnement varié, pas toujours au bureau"}
        ]
    },
    5: {
        "id": 5,
        "text": "Qu'est-ce qui compte le plus pour toi ?",
        "options": [
            {"id": "growth", "text": "L'apprentissage et le développement personnel"},
            {"id": "balance", "text": "L'équilibre vie pro/perso"},
            {"id": "purpose", "text": "Le sens et l'utilité de mon travail"},
            {"id": "success", "text": "La réussite et la reconnaissance"}
        ]
    }
}

@app.get("/")
async def read_root():
    return {"message": "Bienvenue sur l'API du Conseiller d'Orientation!"}

@app.get("/questions/{question_id}")
async def get_question(question_id: int):
    return GENERIC_QUESTIONS.get(question_id, {"error": "Question non trouvée"})

@app.post("/generate_questions")
async def generate_questions(responses: List[UserResponse]):
    try:
        formatted_responses = [
            {
                "question": GENERIC_QUESTIONS[r.question_id]["text"] if r.question_id <= 5 else "Question personnalisée",
                "réponse": next(
                    (opt["text"] for opt in GENERIC_QUESTIONS[r.question_id]["options"] if opt["id"] == r.answer),
                    "Autre réponse" if r.answer == "autre" else r.answer
                ) if r.question_id <= 5 else r.answer
            }
            for r in responses
        ]
        
        # Déterminer le cycle actuel
        cycle = (len(formatted_responses) // 5) + 1
        
        prompt = f"""En tant que conseiller d'orientation expert, analyse ces réponses et génère 5 nouvelles questions générales et inclusives pour le cycle {cycle}/3.

Réponses précédentes du candidat :
{json.dumps(formatted_responses, indent=2, ensure_ascii=False)}

Pour le cycle {cycle}, génère 5 questions qui explorent :

Cycle {cycle} - Thèmes à explorer :
{"- Les centres d'intérêt généraux\\n- Le style de vie souhaité\\n- Les valeurs personnelles\\n- Les préférences de travail\\n- Les sources d'énergie" if cycle == 1 else "- Les objectifs de vie\\n- Les talents naturels\\n- Les rêves professionnels\\n- Le type d'impact désiré\\n- L'environnement idéal" if cycle == 2 else "- Les aspirations profondes\\n- Les besoins essentiels\\n- Les motivations intrinsèques\\n- Les conditions de réussite\\n- Les priorités de vie"}

Format JSON attendu :
[
    {{
        "id": {6 + (cycle-1)*5},
        "text": "Question générale et inclusive",
        "options": [
            {{"id": "option1", "text": "Première option générale"}},
            {{"id": "option2", "text": "Deuxième option générale"}},
            {{"id": "option3", "text": "Troisième option générale"}},
            {{"id": "option4", "text": "Quatrième option générale"}}
        ]
    }},
    // ... répéter pour les 4 autres questions
]

IMPORTANT : 
- Les questions doivent être générales et s'appliquer à tout type de profil
- Évite les questions trop spécifiques ou techniques
- Propose des options larges et inclusives
- Chaque option doit être simple et claire
- Les questions doivent permettre de mieux comprendre la personne sans la mettre dans une case"""

        print(f"Génération des questions pour le cycle {cycle}")

        completion = client.chat.completions.create(
            model="gpt-4-0125-preview",
            messages=[
                {"role": "system", "content": f"Tu es un conseiller d'orientation expert qui génère des questions générales et inclusives. Adapte tes questions pour qu'elles conviennent à tout type de profil. Évite les questions trop spécifiques ou techniques."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7
        )
        
        response_content = completion.choices[0].message.content
        print("Réponse de GPT:", response_content)

        # Nettoyage et validation comme avant...
        response_content = response_content.strip()
        if response_content.startswith("```json"):
            response_content = response_content[7:]
        if response_content.endswith("```"):
            response_content = response_content[:-3]
        response_content = response_content.strip()

        questions = json.loads(response_content)
        
        # Validation
        if not isinstance(questions, list) or len(questions) != 5:
            raise ValueError("La réponse doit contenir exactement 5 questions")
            
        for q in questions:
            if not all(key in q for key in ["id", "text", "options"]):
                raise ValueError("Format de question invalide")
            if not isinstance(q["options"], list) or len(q["options"]) != 4:
                raise ValueError("Chaque question doit avoir exactement 4 options")

        return {"questions": questions}
        
    except json.JSONDecodeError as e:
        print("Erreur de décodage JSON:", str(e))
        print("Contenu reçu:", response_content)
        raise HTTPException(status_code=500, detail="Erreur de format dans la réponse de l'IA")
    except Exception as e:
        print("Erreur lors de la génération des questions:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/recommend")
async def get_recommendations(responses: List[UserResponse]):
    try:
        formatted_responses = [
            {
                "question": GENERIC_QUESTIONS[r.question_id]["text"] if r.question_id <= 5 else "Question personnalisée",
                "réponse": next(
                    (opt["text"] for opt in GENERIC_QUESTIONS[r.question_id]["options"] if opt["id"] == r.answer),
                    r.answer
                ) if r.question_id <= 5 else r.answer
            }
            for r in responses
        ]
        
        prompt = f"""En tant que conseiller d'orientation professionnel, analyse ces réponses et recommande 3 métiers parfaitement adaptés au profil.

Réponses du candidat :
{json.dumps(formatted_responses, indent=2, ensure_ascii=False)}

IMPORTANT :
- Ne te base pas sur les diplômes ou l'expérience
- Concentre-toi sur la personnalité, les talents naturels et les aspirations
- Propose des métiers innovants et motivants
- Explique pourquoi chaque métier correspond parfaitement

Format de réponse :
1. Analyse du profil (3-4 phrases percutantes sur les points forts)

2. Pour chaque métier :
   🎯 [Nom du métier]
   📝 Description inspirante
   ✨ Pourquoi ce métier est fait pour toi
   🔑 Compétences clés à développer
   📚 Parcours possibles pour y arriver"""

        completion = client.chat.completions.create(
            model="gpt-4-0125-preview",
            messages=[
                {"role": "system", "content": "Tu es un conseiller d'orientation visionnaire qui révèle le potentiel des gens et leur suggère des métiers passionnants. Sois inspirant et motivant dans tes recommandations."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7
        )
        
        return {"recommendations": completion.choices[0].message.content}
    except Exception as e:
        print("Erreur lors de la génération des recommandations:", str(e))
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 