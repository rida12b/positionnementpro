from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import json
import os
from dotenv import load_dotenv
import google.generativeai as genai

# Chargement des variables d'environnement
load_dotenv()

# Configuration de Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-pro')

app = FastAPI()

# Configuration CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Modèles de données
class UserResponse(BaseModel):
    question_id: int
    answer: str

# Questions génériques initiales
GENERIC_QUESTIONS = {
    1: {
        "id": 1,
        "text": "Qu'est-ce qui te passionne le plus dans la vie ?",
        "options": [
            {"id": "creative", "text": "Créer et imaginer de nouvelles choses"},
            {"id": "social", "text": "Échanger et partager avec les autres"},
            {"id": "analytical", "text": "Comprendre et analyser le monde"},
            {"id": "practical", "text": "Construire et réaliser des projets concrets"}
        ]
    },
    2: {
        "id": 2,
        "text": "Comment préfères-tu passer ton temps libre ?",
        "options": [
            {"id": "learning", "text": "Apprendre de nouvelles choses"},
            {"id": "helping", "text": "Aider et conseiller les autres"},
            {"id": "making", "text": "Fabriquer ou créer quelque chose"},
            {"id": "exploring", "text": "Explorer et découvrir"}
        ]
    },
    3: {
        "id": 3,
        "text": "Qu'est-ce qui te motive naturellement ?",
        "options": [
            {"id": "impact", "text": "Avoir un impact positif sur les autres"},
            {"id": "knowledge", "text": "Acquérir de nouvelles connaissances"},
            {"id": "creation", "text": "Exprimer ma créativité"},
            {"id": "challenge", "text": "Relever des défis personnels"}
        ]
    },
    4: {
        "id": 4,
        "text": "Dans quel type d'environnement te sens-tu le plus à l'aise ?",
        "options": [
            {"id": "calm", "text": "Un environnement calme et organisé"},
            {"id": "dynamic", "text": "Un environnement dynamique et varié"},
            {"id": "nature", "text": "Un environnement proche de la nature"},
            {"id": "creative", "text": "Un environnement créatif et inspirant"}
        ]
    },
    5: {
        "id": 5,
        "text": "Qu'est-ce qui compte le plus pour toi ?",
        "options": [
            {"id": "freedom", "text": "La liberté d'être moi-même"},
            {"id": "harmony", "text": "L'harmonie avec les autres"},
            {"id": "growth", "text": "L'évolution personnelle"},
            {"id": "achievement", "text": "L'accomplissement de mes objectifs"}
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
                    r.answer
                ) if r.question_id <= 5 else r.answer
            }
            for r in responses
        ]
        
        cycle = (len(formatted_responses) // 5) + 1
        print(f"🔄 Début de la génération des questions pour le cycle {cycle}/3")
        print(f"📝 Réponses précédentes : {json.dumps(formatted_responses, indent=2, ensure_ascii=False)}")
        
        prompt = f"""En tant qu'expert en orientation professionnelle, génère EXACTEMENT 5 questions pour le cycle {cycle}/3.

ATTENTION : Tu DOIS générer EXACTEMENT 5 questions, ni plus ni moins.

Format JSON STRICT à respecter :
[
  {{
    "id": {6 + (cycle-1)*5},
    "text": "Question courte et claire ?",
    "options": [
      {{"id": "option1", "text": "Réponse simple et concise"}},
      {{"id": "option2", "text": "Autre réponse claire"}},
      {{"id": "option3", "text": "Troisième option précise"}},
      {{"id": "option4", "text": "Dernière option"}}
    ]
  }},
  ... EXACTEMENT 4 questions supplémentaires avec le même format
]

RÈGLES ABSOLUES :
1. EXACTEMENT 5 questions, ni plus ni moins
2. IDs EXACTS : {6 + (cycle-1)*5} à {10 + (cycle-1)*5}
3. EXACTEMENT 4 options par question
4. Format JSON strict sans décoration
5. Pas de texte avant ou après le JSON
6. Questions courtes et claires
7. Options concises et précises

Thème pour le cycle {cycle}/3 :
{{"1": "Passions (activités préférées, moments de flow, sources d'énergie)",
"2": "Valeurs (fierté, confiance, environnement idéal, relations)",
"3": "Vision (succès personnel, impact souhaité, vie épanouie, aspirations)"}}[str(cycle)]"""

        print("🤖 Envoi du prompt à Gemini...")
        
        max_retries = 3
        current_try = 0
        
        while current_try < max_retries:
            current_try += 1
            print(f"🔄 Tentative {current_try}/{max_retries}")
            
            try:
                response = model.generate_content(prompt)
                response_text = response.text.strip()
                
                print(f"📥 Réponse brute de Gemini :")
                print(response_text)
                
                # Nettoyage du JSON
                if response_text.startswith('```json'):
                    response_text = response_text[7:]
                if response_text.startswith('```'):
                    response_text = response_text[3:]
                if response_text.endswith('```'):
                    response_text = response_text[:-3]
                response_text = response_text.strip()
                
                # Suppression des caractères spéciaux et espaces superflus
                response_text = response_text.replace('\n', ' ').replace('\r', ' ')
                response_text = ' '.join(response_text.split())
                
                print(f"🧹 JSON nettoyé :")
                print(response_text)
                
                # Premier essai de parsing
                try:
                    questions = json.loads(response_text)
                except json.JSONDecodeError as e:
                    print(f"⚠️ Erreur de parsing JSON : {str(e)}")
                    # Tentative de correction
                    response_text = response_text.replace('""', '"')
                    response_text = response_text.replace(',,', ',')
                    response_text = response_text.replace('[,', '[')
                    response_text = response_text.replace(',]', ']')
                    print("🔧 Tentative de correction du JSON :")
                    print(response_text)
                    questions = json.loads(response_text)
                
                # Vérification du nombre de questions
                if not isinstance(questions, list):
                    print("❌ Erreur : La réponse n'est pas un tableau")
                    if current_try < max_retries:
                        continue
                    raise ValueError("Format de réponse invalide : tableau attendu")
                
                if len(questions) != 5:
                    print(f"❌ Erreur : Nombre de questions incorrect ({len(questions)})")
                    # Tentative de correction automatique
                    if len(questions) < 5:
                        print("🔧 Tentative d'ajout de questions manquantes")
                        while len(questions) < 5:
                            new_id = 6 + (cycle-1)*5 + len(questions)
                            questions.append({
                                "id": new_id,
                                "text": f"Question supplémentaire {len(questions) + 1} ?",
                                "options": [
                                    {"id": "option1", "text": "Première option"},
                                    {"id": "option2", "text": "Deuxième option"},
                                    {"id": "option3", "text": "Troisième option"},
                                    {"id": "option4", "text": "Quatrième option"}
                                ]
                            })
                    elif len(questions) > 5:
                        print("🔧 Suppression des questions en excès")
                        questions = questions[:5]
                
                # Validation de chaque question
                for i, q in enumerate(questions):
                    expected_id = 6 + (cycle-1)*5 + i
                    if q["id"] != expected_id:
                        print(f"⚠️ Correction de l'ID : {q['id']} -> {expected_id}")
                        q["id"] = expected_id
                    
                    if not isinstance(q.get("options"), list) or len(q["options"]) != 4:
                        print(f"❌ Erreur : Options incorrectes pour la question {i+1}")
                        if current_try < max_retries:
                            continue
                        raise ValueError(f"La question {i+1} doit avoir exactement 4 options")
                
                print("✅ Validation réussie !")
                return {"questions": questions}
                
            except Exception as e:
                print(f"❌ Erreur lors de la tentative {current_try} :", str(e))
                if current_try == max_retries:
                    raise
        
        raise Exception("Nombre maximum de tentatives atteint")
        
    except Exception as e:
        print("❌ Erreur finale :", str(e))
        raise HTTPException(
            status_code=500,
            detail=f"Erreur lors de la génération des questions : {str(e)}. Veuillez réessayer."
        )

# Fonction pour calculer la similarité entre deux chaînes
def similar(a: str, b: str) -> float:
    """Calcule la similarité entre deux chaînes en utilisant la distance de Levenshtein."""
    from difflib import SequenceMatcher
    return SequenceMatcher(None, a, b).ratio()

@app.post("/recommend")
async def get_recommendations(responses: List[UserResponse]):
    try:
        print("🔄 Début de la génération des recommandations")
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
        
        print(f"📝 Analyse des réponses : {json.dumps(formatted_responses, indent=2, ensure_ascii=False)}")
        
        prompt = f"""En tant qu'expert en orientation professionnelle, analyse ces réponses et propose des recommandations de carrière détaillées.

Voici les réponses du candidat :
{json.dumps(formatted_responses, indent=2, ensure_ascii=False)}

IMPORTANT : Respecte STRICTEMENT ce format de réponse :

✨ ANALYSE DU PROFIL
[Analyse détaillée des points forts, motivations et aspirations du candidat]

🎯 MÉTIERS RECOMMANDÉS

1. [Nom du métier] (Match : XX%)
Description : [Description détaillée du métier]

Points de concordance :
• [Point 1]
• [Point 2]
• [Point 3]

Compétences à développer :
• [Compétence 1]
• [Compétence 2]
• [Compétence 3]

Parcours recommandé :
• [Étape 1]
• [Étape 2]
• [Étape 3]

[Répéter exactement le même format pour 2 autres métiers]

RÈGLES IMPORTANTES :
1. Inclure EXACTEMENT 3 métiers
2. Chaque métier doit avoir un score de correspondance (Match : XX%)
3. Respecter strictement les sections (Description, Points de concordance, etc.)
4. Utiliser des puces (•) pour les listes
5. Être concret et spécifique dans les recommandations"""

        print("🤖 Envoi du prompt à Gemini...")
        
        max_retries = 3
        current_try = 0
        
        while current_try < max_retries:
            try:
                current_try += 1
                print(f"🔄 Tentative {current_try}/{max_retries}")
                
                response = model.generate_content(prompt)
                recommendations = response.text.strip()
                
                # Vérification du format
                if "✨ ANALYSE DU PROFIL" not in recommendations or "🎯 MÉTIERS RECOMMANDÉS" not in recommendations:
                    print("❌ Format incorrect : sections manquantes")
                    if current_try < max_retries:
                        continue
                    raise ValueError("Format de réponse incorrect")
                
                # Vérification des métiers
                if recommendations.count("Match :") < 3:
                    print("❌ Nombre incorrect de métiers recommandés")
                    if current_try < max_retries:
                        continue
                    raise ValueError("Nombre incorrect de métiers recommandés")
                
                print("✅ Recommandations générées avec succès !")
                return {"recommendations": recommendations}
                
            except Exception as e:
                print(f"❌ Erreur lors de la tentative {current_try} :", str(e))
                if current_try == max_retries:
                    raise
        
        raise Exception("Nombre maximum de tentatives atteint")
        
    except Exception as e:
        print("❌ Erreur finale :", str(e))
        raise HTTPException(
            status_code=500,
            detail="Une erreur est survenue lors de la génération des recommandations. Veuillez réessayer."
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 