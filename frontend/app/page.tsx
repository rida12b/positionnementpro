'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XMarkIcon } from '@heroicons/react/24/outline';

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
  concordancePoints: string[];
  skillsToAcquire: string[];
  recommendedPath: string[];
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
  const [selectedCareer, setSelectedCareer] = useState<DetailedCareerRecommendation | null>(null);

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

  const openModal = (career: DetailedCareerRecommendation) => {
    setSelectedCareer(career);
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
              
              {recommendations.map((career, index) => {
                const parsed = parseCareerDescription(career.description);
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="space-y-8"
                  >
                    {/* Analyse du profil */}
                    <div className="bg-gradient-to-br from-purple-50 via-pink-50 to-white p-8 rounded-3xl border border-purple-100 shadow-xl relative overflow-hidden group">
                      {/* Cercles décoratifs */}
                      <div className="absolute -top-12 -right-12 w-24 h-24 bg-gradient-to-br from-purple-200 to-pink-200 rounded-full opacity-50 blur-xl group-hover:scale-150 transition-transform duration-700"></div>
                      <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-gradient-to-br from-pink-200 to-purple-200 rounded-full opacity-50 blur-xl group-hover:scale-150 transition-transform duration-700"></div>
                      
                      {/* En-tête avec icône et titre */}
                      <div className="flex items-center gap-4 mb-8 relative">
                        <motion.div 
                          className="bg-gradient-to-br from-purple-600 to-pink-600 p-4 rounded-2xl shadow-lg"
                          whileHover={{ scale: 1.05, rotate: 5 }}
                          transition={{ type: "spring", stiffness: 300 }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </motion.div>
                        <div>
                          <h3 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 text-transparent bg-clip-text">
                            Analyse de ton profil ✨
                          </h3>
                          <p className="text-gray-600 mt-1">Découvre ce qui te rend unique</p>
                        </div>
                      </div>

                      {/* Contenu de l'analyse */}
                      <div className="space-y-8">
                        {/* Introduction */}
                        <motion.div 
                          className="relative z-10 bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-sm border border-purple-50"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5 }}
                        >
                          <p className="text-2xl font-bold text-purple-600 mb-4">{parsed.profileAnalysis.intro}</p>
                          <p className="text-lg text-gray-700 leading-relaxed mb-4">{parsed.profileAnalysis.mainAnalysis}</p>
                          <p className="text-lg text-gray-700 leading-relaxed italic">{parsed.profileAnalysis.compliment}</p>
                        </motion.div>

                        {/* Points forts */}
                        <div className="space-y-4">
                          <h4 className="text-xl font-bold text-purple-600">⚡ Points forts</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {parsed.profileAnalysis.strengths.map((strength, index) => (
                              <motion.div
                                key={index}
                                className="bg-white/90 p-6 rounded-xl shadow-sm border border-purple-50 hover:shadow-md transition-all"
                                whileHover={{ scale: 1.02 }}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                              >
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="text-2xl">{strength.icon}</span>
                                  <h5 className="font-bold text-purple-600">{strength.title}</h5>
                                </div>
                                <p className="text-gray-600">{strength.description}</p>
                              </motion.div>
                            ))}
                          </div>
                        </div>

                        {/* Environnement idéal */}
                        <div className="space-y-4">
                          <h4 className="text-xl font-bold text-purple-600">🏡 Ton environnement de travail idéal</h4>
                          <div className="grid grid-cols-1 gap-4">
                            {parsed.profileAnalysis.idealEnvironment.map((env, index) => (
                              <motion.div
                                key={index}
                                className="bg-white/90 p-4 rounded-xl shadow-sm border border-purple-50 flex items-center gap-4"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 }}
                              >
                                <span className="text-2xl">{env.icon}</span>
                                <p className="text-gray-600">{env.description}</p>
                              </motion.div>
                            ))}
                          </div>
                        </div>

                        {/* Conclusion */}
                        <motion.div
                          className="bg-gradient-to-r from-purple-100 to-pink-100 p-6 rounded-xl text-center"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.5 }}
                        >
                          <p className="text-lg font-bold text-purple-600">{parsed.profileAnalysis.conclusion}</p>
                        </motion.div>
                      </div>
                    </div>

                    {/* Métiers recommandés */}
                    <h3 className="text-2xl font-bold text-center mb-8 bg-gradient-to-r from-purple-600 to-pink-600 text-transparent bg-clip-text">
                      Découvre les métiers qui te correspondent ! 🎯
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
                      {parsed.careers.map((career, careerIndex) => (
                        <motion.div
                          key={careerIndex}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 + careerIndex * 0.1 }}
                          className="group relative"
                        >
                          {/* Badge de correspondance */}
                          <div className="absolute -top-4 -right-4 z-20">
                            <div className="relative">
                              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full blur-lg opacity-50"></div>
                              <div className="relative bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
                                Match: {career.matchScore}%
                              </div>
                            </div>
                          </div>

                          {/* Carte de métier */}
                          <div className="bg-white rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 border-2 border-purple-100 hover:border-purple-300 relative overflow-hidden group">
                            {/* Icône de rang */}
                            <div className="absolute -top-6 -left-6 bg-gradient-to-r from-purple-100 to-pink-100 w-20 h-20 rounded-full flex items-center justify-center transform rotate-12 group-hover:scale-110 transition-transform">
                              <span className="text-4xl transform -rotate-12">
                                {careerIndex === 0 ? "🥇" : careerIndex === 1 ? "🥈" : "🥉"}
                              </span>
                            </div>

                            {/* Contenu */}
                            <div className="mt-4">
                              <h4 className="text-2xl font-bold text-purple-600 mb-4 pl-8">
                                {career.title}
                              </h4>
                              <p className="text-gray-600 mb-6 min-h-[80px]">
                                {career.shortDescription}
                              </p>
                              
                              {/* Bouton "En savoir plus" */}
                              <button 
                                onClick={() => openModal(career)}
                                className="w-full bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 text-purple-600 font-medium py-3 px-6 rounded-xl transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2 group-hover:shadow-md"
                              >
                                En savoir plus
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transition-transform group-hover:translate-x-1" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                );
              })}
              
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

      {selectedCareer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-4 rounded-t-lg">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-white">{selectedCareer.title}</h3>
                <button onClick={() => setSelectedCareer(null)} className="text-white hover:text-gray-200">
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <section>
                <h4 className="text-lg font-semibold text-purple-600 mb-2">📝 Description</h4>
                <p className="text-gray-700">{selectedCareer.fullDescription}</p>
              </section>

              <section>
                <h4 className="text-lg font-semibold text-purple-600 mb-2">✨ Points de concordance</h4>
                <ul className="list-disc list-inside text-gray-700 space-y-2">
                  {selectedCareer.concordancePoints.map((point, index) => (
                    <li key={index}>{point}</li>
                  ))}
                </ul>
              </section>

              <section>
                <h4 className="text-lg font-semibold text-purple-600 mb-2">🎯 Compétences à développer</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedCareer.skillsToAcquire.map((skill, index) => (
                    <span key={index} className="bg-purple-100 text-purple-600 px-3 py-1 rounded-full text-sm">
                      {skill}
                    </span>
                  ))}
                </div>
              </section>

              <section>
                <h4 className="text-lg font-semibold text-purple-600 mb-2">🎓 Parcours recommandé</h4>
                <ul className="list-disc list-inside text-gray-700 space-y-2">
                  {selectedCareer.recommendedPath.map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ul>
              </section>
            </div>

            <div className="p-4 border-t">
              <button
                onClick={() => setSelectedCareer(null)}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-2 px-4 rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-300"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// Fonction utilitaire pour parser la description
function parseCareerDescription(description: string): {
  profileAnalysis: {
    intro: string;
    mainAnalysis: string;
    compliment: string;
    strengths: Array<{
      title: string;
      description: string;
      icon: string;
    }>;
    idealEnvironment: Array<{
      description: string;
      icon: string;
    }>;
    conclusion: string;
  };
  careers: DetailedCareerRecommendation[];
} {
  const lines = description.split('\n');
  let currentSection = '';
  let currentCareer: Partial<DetailedCareerRecommendation> = {};
  const result = {
    profileAnalysis: {
      intro: "✨ Wow, ton profil est unique et plein de potentiel ! 🚀 Découvrons ensemble ce qui te rend spécial(e)...",
      mainAnalysis: "Tu es une personne naturellement créative et pleine d'idées ! Ton imagination et ton désir d'apprendre font de toi quelqu'un qui aime repousser les limites et explorer de nouvelles perspectives. 🌟",
      compliment: "Tu as un véritable don pour trouver des solutions originales et transformer tes idées en actions concrètes. C'est une qualité précieuse dans de nombreux domaines !",
      strengths: [
        {
          title: "Créativité",
          description: "Ton esprit innovant te permet d'imaginer des solutions inédites",
          icon: "🌟"
        },
        {
          title: "Capacité d'apprentissage",
          description: "Tu as une soif de découverte et une capacité à évoluer rapidement",
          icon: "🚀"
        },
        {
          title: "Esprit novateur",
          description: "Tu aimes voir plus loin et créer quelque chose de nouveau",
          icon: "💡"
        }
      ],
      idealEnvironment: [
        {
          description: "Un espace calme et structuré, où tu peux organiser tes idées en toute sérénité",
          icon: "🏡"
        },
        {
          description: "Un cadre stimulant et harmonieux, propice à la concentration et à l'épanouissement personnel",
          icon: "✨"
        },
        {
          description: "Un lieu où tu peux exprimer pleinement ta créativité et évoluer à ton rythme",
          icon: "🎯"
        }
      ],
      conclusion: "Grâce à ces qualités, tu es fait(e) pour exceller dans des métiers qui nécessitent créativité et réflexion ! 🎯 Prêt(e) à découvrir quels métiers te correspondent ? 🔥"
    },
    careers: [] as DetailedCareerRecommendation[]
  };

  let concordancePoints: string[] = [];
  let skillsToAcquire: string[] = [];
  let recommendedPath: string[] = [];

  lines.forEach(line => {
    line = line.trim();
    if (!line) return;

    // Gestion des sections principales
    if (line.includes('✨ ANALYSE DU PROFIL')) {
      currentSection = 'profile';
    } else if (line.includes('🎯 MÉTIERS RECOMMANDÉS')) {
      currentSection = 'careers';
    } else if (line.match(/^\d\.\s+.*\(Match\s*:\s*\d+%\)/)) {
      // Nouveau métier détecté
      if (currentCareer.title) {
        // Sauvegarder le métier précédent
        currentCareer.concordancePoints = concordancePoints;
        currentCareer.skillsToAcquire = skillsToAcquire;
        currentCareer.recommendedPath = recommendedPath;
        result.careers.push(currentCareer as DetailedCareerRecommendation);
      }
      
      // Initialiser un nouveau métier
      const matchMatch = line.match(/Match\s*:\s*(\d+)%/);
      const title = line.replace(/^\d\.\s+/, '').split('(Match')[0].trim();
      
      currentCareer = {
        title: title,
        matchScore: matchMatch ? parseInt(matchMatch[1]) : 85,
        shortDescription: '',
        fullDescription: '',
        keySkills: [],
        icon: '💼',
        concordancePoints: [],
        skillsToAcquire: [],
        recommendedPath: []
      };
      
      concordancePoints = [];
      skillsToAcquire = [];
      recommendedPath = [];
      currentSection = 'career';
    } else if (line.startsWith('Description :')) {
      currentSection = 'description';
    } else if (line.startsWith('Points de concordance :')) {
      currentSection = 'concordance';
    } else if (line.startsWith('Compétences à développer :')) {
      currentSection = 'skills';
    } else if (line.startsWith('Parcours recommandé :')) {
      currentSection = 'path';
    } else if (line.startsWith('•')) {
      // Gestion des points listés
      const content = line.replace('•', '').trim();
      switch (currentSection) {
        case 'concordance':
          concordancePoints.push(content);
          break;
        case 'skills':
          skillsToAcquire.push(content);
          break;
        case 'path':
          recommendedPath.push(content);
          break;
      }
    } else {
      // Gestion du contenu des sections
      switch (currentSection) {
        case 'description':
          if (currentCareer.shortDescription) {
            currentCareer.fullDescription = line;
          } else {
            currentCareer.shortDescription = line;
          }
          break;
      }
    }
  });

  // Ajouter le dernier métier
  if (currentCareer.title) {
    currentCareer.concordancePoints = concordancePoints;
    currentCareer.skillsToAcquire = skillsToAcquire;
    currentCareer.recommendedPath = recommendedPath;
    result.careers.push(currentCareer as DetailedCareerRecommendation);
  }

  return result;
} 