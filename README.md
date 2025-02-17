# 🎯 Conseiller d'Orientation - Chatbot Interactif

Un chatbot interactif qui aide les utilisateurs à découvrir les métiers qui leur correspondent le mieux en fonction de leurs réponses à une série de questions.

## 🚀 Fonctionnalités

- Interface conversationnelle fluide et intuitive
- Questions interactives avec choix multiples
- Animations fluides pour une expérience engageante
- Recommandations personnalisées de métiers
- Design responsive et moderne

## 🛠️ Technologies Utilisées

### Frontend
- Next.js 14
- React
- Tailwind CSS
- Framer Motion

### Backend
- FastAPI
- Python 3.8+
- Uvicorn

## 📦 Installation

### Prérequis
- Node.js 18+
- Python 3.8+
- npm ou yarn

### Backend

1. Créer un environnement virtuel Python :
```bash
cd backend
python -m venv venv
```

2. Activer l'environnement virtuel :
```bash
# Windows
.\venv\Scripts\activate

# Linux/MacOS
source venv/bin/activate
```

3. Installer les dépendances :
```bash
pip install -r requirements.txt
```

4. Lancer le serveur :
```bash
uvicorn main:app --reload
```

Le backend sera accessible sur `http://localhost:8000`

### Frontend

1. Installer les dépendances :
```bash
cd frontend
npm install
# ou
yarn install
```

2. Lancer le serveur de développement :
```bash
npm run dev
# ou
yarn dev
```

Le frontend sera accessible sur `http://localhost:3000`

## 🌐 Utilisation

1. Ouvrir `http://localhost:3000` dans votre navigateur
2. Cliquer sur "Commencer l'aventure"
3. Répondre aux questions proposées
4. Découvrir les métiers recommandés !

## 📝 Développement

### Structure du Projet

```
.
├── frontend/
│   ├── app/
│   │   └── page.tsx      # Page principale
│   ├── components/       # Composants React
│   └── public/          # Assets statiques
│
└── backend/
    ├── main.py         # Application FastAPI
    └── data/
        └── careers.json # Base de données des métiers
```

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
1. Fork le projet
2. Créer une branche pour votre fonctionnalité
3. Commiter vos changements
4. Pousser vers la branche
5. Ouvrir une Pull Request

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails. 