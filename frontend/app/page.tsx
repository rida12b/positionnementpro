'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Question {
  id: number;
  text: string;
  options: Array<{
    id: string;
    text: string;
  }>;
}

interface UserResponse {
  question_id: number;
  answer: string;
}

interface CareerRecommendation {
  title: string;
  description: string;
  score: number;
}

interface DetailedCareerRecommendation {
  title: string;
  shortDescription: string;
  fullDescription: string;
  matchScore: number;
  keySkills: string[];
  icon: string;
}

export default function Home() {
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [responses, setResponses] = useState<UserResponse[]>([]);
  const [recommendations, setRecommendations] = useState<CareerRecommendation[]>([]);
  const [isStarted, setIsStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [phase, setPhase] = useState<'generic' | 'personalized' | 'finished'>('generic');
  const [personalizedQuestions, setPersonalizedQuestions] = useState<Question[]>([]);
  const [currentPersonalizedIndex, setCurrentPersonalizedIndex] = useState(0);
  const [cycle, setCycle] = useState(1);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const startChat = async () => {
    try {
      setIsLoading(true);
      setIsStarted(true);
      setPhase('generic');
      setCycle(1);
      setProgress(0);
      const response = await fetch('http://127.0.0.1:8000/questions/1', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const question = await response.json();
      setCurrentQuestion(question);
    } catch (error) {
      console.error("Erreur lors du démarrage du chat:", error);
      alert("Impossible de se connecter au serveur. Assurez-vous que le backend est en cours d'exécution sur le port 8000.");
      setIsStarted(false);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateProgress = () => {
    const totalQuestions = 20; // 5 questions génériques + 5 questions personnalisées * 3 cycles
    let currentQuestionNumber = 0;
    
    if (phase === 'generic') {
      currentQuestionNumber = currentQuestion?.id || 0;
    } else {
      currentQuestionNumber = 5 + ((cycle - 1) * 5) + (currentPersonalizedIndex + 1);
    }
    
    return Math.round((currentQuestionNumber / totalQuestions) * 100);
  };

  const handleAnswer = async (answerId: string) => {
    if (!currentQuestion) return;

    try {
      setIsLoading(true);
      const newResponse = {
        question_id: currentQuestion.id,
        answer: answerId,
      };

      const updatedResponses = [...responses, newResponse];
      setResponses(updatedResponses);
      setProgress(calculateProgress());

      if (phase === 'generic') {
        if (currentQuestion.id < 5) {
          const response = await fetch(`http://127.0.0.1:8000/questions/${currentQuestion.id + 1}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          });
          
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          const nextQuestion = await response.json();
          setCurrentQuestion(nextQuestion);
        } else {
          // Générer les questions personnalisées
          console.log("Envoi des réponses pour générer les questions personnalisées (Cycle " + cycle + "):", updatedResponses);
          
          const personalizedResponse = await fetch('http://127.0.0.1:8000/generate_questions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify(updatedResponses),
          });

          if (!personalizedResponse.ok) {
            const errorData = await personalizedResponse.text();
            console.error("Erreur du serveur:", errorData);
            throw new Error(`Erreur lors de la génération des questions personnalisées: ${errorData}`);
          }

          const data = await personalizedResponse.json();
          console.log("Questions personnalisées reçues:", data);
          
          if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
            throw new Error("Format de réponse invalide pour les questions personnalisées");
          }

          setPersonalizedQuestions(data.questions);
          setPhase('personalized');
          setCurrentPersonalizedIndex(0);
          setCurrentQuestion(data.questions[0]);
        }
      } else if (phase === 'personalized') {
        if (currentPersonalizedIndex < personalizedQuestions.length - 1) {
          setCurrentPersonalizedIndex(currentPersonalizedIndex + 1);
          setCurrentQuestion(personalizedQuestions[currentPersonalizedIndex + 1]);
        } else if (cycle < 3) {
          // Passer au cycle suivant
          setCycle(cycle + 1);
          
          // Générer directement de nouvelles questions personnalisées pour le nouveau cycle
          console.log("Génération des questions pour le cycle " + (cycle + 1));
          
          const personalizedResponse = await fetch('http://127.0.0.1:8000/generate_questions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify(updatedResponses),
          });

          if (!personalizedResponse.ok) {
            const errorData = await personalizedResponse.text();
            console.error("Erreur du serveur:", errorData);
            throw new Error(`Erreur lors de la génération des questions personnalisées: ${errorData}`);
          }

          const data = await personalizedResponse.json();
          console.log("Nouvelles questions générées pour le cycle " + (cycle + 1) + ":", data);
          
          if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
            throw new Error("Format de réponse invalide pour les questions personnalisées");
          }

          setPersonalizedQuestions(data.questions);
          setPhase('personalized');
          setCurrentPersonalizedIndex(0);
          setCurrentQuestion(data.questions[0]);
        } else {
          // Obtenir les recommandations finales
          const recommendationsResponse = await fetch('http://127.0.0.1:8000/recommend', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            body: JSON.stringify(updatedResponses),
          });
          
          if (!recommendationsResponse.ok) {
            const errorData = await recommendationsResponse.text();
            console.error("Erreur du serveur:", errorData);
            throw new Error(`Erreur lors de la génération des recommandations: ${errorData}`);
          }
          
          const data = await recommendationsResponse.json();
          setRecommendations([{
            title: "Recommandations",
            description: data.recommendations,
            score: 1
          }]);
          setPhase('finished');
          setIsFinished(true);
          setCurrentQuestion(null);
        }
      }
    } catch (error) {
      console.error("Erreur détaillée:", error);
      alert(`Une erreur est survenue: ${error instanceof Error ? error.message : 'Erreur inconnue'}. Veuillez réessayer ou rafraîchir la page.`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-6 md:p-24 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 relative overflow-hidden">
      {/* Éléments de décoration en arrière-plan */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute w-96 h-96 bg-blue-400 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"
          animate={{
            x: [0, 100, 0],
            y: [0, -100, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            repeatType: "reverse"
          }}
        />
        <motion.div
          className="absolute w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000 right-0"
          animate={{
            x: [0, -100, 0],
            y: [0, 100, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            repeatType: "reverse"
          }}
        />
        <motion.div
          className="absolute w-96 h-96 bg-pink-400 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000 bottom-0"
          animate={{
            x: [0, 100, 0],
            y: [0, 100, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            repeatType: "reverse"
          }}
        />
      </div>

      <div className="z-10 w-full max-w-4xl items-center justify-center font-sans">
        <AnimatePresence mode="wait">
          {!isStarted ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="text-center"
            >
              <motion.h1 
                className="text-6xl font-bold text-white mb-8 text-shadow-lg"
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
              >
                Découvre ton futur métier ! 🚀
              </motion.h1>
              <motion.p 
                className="text-2xl text-white mb-12 leading-relaxed font-light"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                Embarque dans un voyage passionnant pour découvrir les métiers qui te correspondent vraiment. 
                <br/>
                <span className="font-medium">Je vais te poser quelques questions pour mieux te connaître ! ✨</span>
              </motion.p>
              <motion.button
                onClick={startChat}
                className="bg-white/90 backdrop-blur-sm text-purple-600 px-12 py-6 rounded-full font-bold text-xl hover:bg-white transition-all transform hover:scale-105 shadow-xl hover:shadow-2xl"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Commencer l'aventure 🎯
              </motion.button>
            </motion.div>
          ) : !isFinished ? (
            currentQuestion && (
              <motion.div
                key={currentQuestion.id}
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -100 }}
                className="bg-white/90 backdrop-blur-xl rounded-3xl p-8 shadow-2xl w-full mx-auto border border-white/20"
              >
                {isLoading ? (
                  <motion.div 
                    className="flex flex-col items-center justify-center py-12"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div className="w-24 h-24 mb-8">
                      <motion.div 
                        className="w-full h-full border-4 border-purple-500 border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      />
                    </div>
                    <p className="text-2xl text-purple-600 font-medium text-center max-w-md mx-auto">
                      {phase === 'personalized' ? (
                        <>
                          <span className="block mb-3">🤔 J'analyse tes réponses...</span>
                          <span className="text-lg text-purple-500">Je prépare des questions plus spécifiques pour mieux comprendre ton profil</span>
                        </>
                      ) : (
                        <>
                          <span className="block mb-3">✨ Un instant magique...</span>
                          <span className="text-lg text-purple-500">Je réfléchis à la meilleure façon d'explorer tes aspirations</span>
                        </>
                      )}
                    </p>
                  </motion.div>
                ) : (
                  <>
                    <motion.div 
                      className="mb-8 text-base font-medium flex justify-between items-center"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <span className="bg-purple-100 text-purple-600 px-6 py-3 rounded-full font-bold shadow-md">
                        {phase === 'generic' ? 
                          `Phase ${cycle}/3 : Mieux te connaître 🎯` : 
                          `Phase ${cycle}/3 : Questions personnalisées ✨`}
                      </span>
                      <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-transparent bg-clip-text font-bold text-xl">
                        {progress}%
                      </span>
                    </motion.div>
                    <div className="w-full bg-gray-100 rounded-full h-4 mb-10 overflow-hidden shadow-inner">
                      <motion.div
                        className="bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500 h-full rounded-full relative"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.5 }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent"></div>
                      </motion.div>
                    </div>
                    <motion.h2 
                      className="text-3xl font-bold text-gray-800 mb-10 leading-relaxed"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      {currentQuestion.text}
                    </motion.h2>
                    <div className="grid grid-cols-1 gap-4">
                      {currentQuestion.options.map((option, index) => (
                        <motion.button
                          key={option.id}
                          onClick={() => handleAnswer(option.id)}
                          className="text-left p-6 bg-gradient-to-r from-white to-gray-50 border-2 border-gray-200 rounded-2xl hover:border-purple-400 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 transition-all transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 shadow-lg hover:shadow-xl relative group"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <span className="text-lg font-medium relative z-10 group-hover:text-purple-700 transition-colors">
                            {option.text}
                          </span>
                          <div className="absolute inset-0 bg-gradient-to-r from-purple-100/0 to-pink-100/0 group-hover:from-purple-100 group-hover:to-pink-100 rounded-2xl transition-opacity opacity-0 group-hover:opacity-100"></div>
                        </motion.button>
                      ))}
                      <motion.button
                        onClick={() => handleAnswer('autre')}
                        className="text-left p-6 bg-gradient-to-r from-white to-gray-50 border-2 border-gray-200 rounded-2xl hover:border-purple-400 hover:bg-gradient-to-r hover:from-purple-50 hover:to-pink-50 transition-all transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 shadow-lg hover:shadow-xl relative group"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <span className="text-lg italic relative z-10 group-hover:text-purple-700 transition-colors">
                          ✨ Aucune de ces réponses ne me correspond vraiment...
                        </span>
                        <div className="absolute inset-0 bg-gradient-to-r from-purple-100/0 to-pink-100/0 group-hover:from-purple-100 group-hover:to-pink-100 rounded-2xl transition-opacity opacity-0 group-hover:opacity-100"></div>
                      </motion.button>
                    </div>
                  </>
                )}
              </motion.div>
            )
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white/90 backdrop-blur-xl rounded-3xl p-8 shadow-2xl w-full max-w-4xl mx-auto border border-white/20"
            >
              <motion.h2 
                className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 text-transparent bg-clip-text mb-8 text-center"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                Découvre les métiers qui te correspondent ! 🎉
              </motion.h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {recommendations.map((career, index) => {
                  // Conversion du texte en format structuré
                  const parsedCareer = parseCareerDescription(career.description);
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.2 }}
                      className="group relative"
                    >
                      {/* Carte de base */}
                      <div className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border-2 border-purple-100 hover:border-purple-300">
                        <div className="text-2xl font-bold text-purple-600 mb-3">
                          {parsedCareer.title}
                        </div>
                        <p className="text-gray-600">
                          {parsedCareer.shortDescription}
                        </p>
                        
                        {/* Badge de correspondance */}
                        <div className="absolute top-4 right-4 bg-purple-100 text-purple-600 px-3 py-1 rounded-full text-sm font-medium">
                          Match: {parsedCareer.matchScore}%
                        </div>

                        {/* Détails au survol */}
                        <div className="absolute inset-0 bg-white/95 backdrop-blur-sm rounded-xl p-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300 overflow-y-auto max-h-full">
                          <h3 className="text-xl font-bold text-purple-600 mb-4">{parsedCareer.title}</h3>
                          <div className="space-y-4">
                            <p className="text-gray-700">{parsedCareer.fullDescription}</p>
                            <div>
                              <h4 className="font-semibold text-purple-500 mb-2">Compétences clés :</h4>
                              <div className="flex flex-wrap gap-2">
                                {parsedCareer.keySkills.map((skill, i) => (
                                  <span key={i} className="bg-purple-100 text-purple-600 px-3 py-1 rounded-full text-sm">
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
              <motion.div 
                className="mt-12 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
              >
                <button
                  onClick={() => {
                    setIsStarted(false);
                    setIsFinished(false);
                    setResponses([]);
                    setRecommendations([]);
                    setPhase('generic');
                    setPersonalizedQuestions([]);
                    setCurrentPersonalizedIndex(0);
                    setCycle(1);
                    setProgress(0);
                  }}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-12 py-6 rounded-full font-bold text-xl hover:opacity-90 transition-all transform hover:scale-105 shadow-xl hover:shadow-2xl"
                >
                  Recommencer l'aventure 🔄
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

// Fonction utilitaire pour parser la description
function parseCareerDescription(description: string): DetailedCareerRecommendation {
  // Analyse du texte formaté par l'IA pour extraire les informations structurées
  const lines = description.split('\n');
  let currentSection = '';
  const result: DetailedCareerRecommendation = {
    title: '',
    shortDescription: '',
    fullDescription: '',
    matchScore: Math.round(Math.random() * 30 + 70), // 70-100%
    keySkills: [],
    icon: '💼'
  };

  lines.forEach(line => {
    if (line.includes('🎯')) {
      result.title = line.replace('🎯', '').trim();
    } else if (line.includes('📝')) {
      result.shortDescription = line.replace('📝', '').trim();
    } else if (line.includes('✨')) {
      result.fullDescription = line.replace('✨', '').trim();
    } else if (line.includes('🔑')) {
      const skills = line.replace('🔑', '').trim();
      result.keySkills = skills.split(',').map(s => s.trim());
    }
  });

  return result;
} 