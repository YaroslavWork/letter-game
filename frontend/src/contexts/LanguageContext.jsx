import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { english } from '../locales/english';
import { polish } from '../locales/polish';

const LanguageContext = createContext(null);

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

// Language files mapping
const languages = {
  english,
  polish,
};

export const LanguageProvider = ({ children, defaultLanguage = 'english' }) => {
  // Load language from localStorage or use default
  const getInitialLanguage = () => {
    const savedLanguage = localStorage.getItem('app_language');
    return savedLanguage && languages[savedLanguage] ? savedLanguage : defaultLanguage;
  };

  const [language, setLanguage] = useState(getInitialLanguage);

  // Save language preference to localStorage
  useEffect(() => {
    localStorage.setItem('app_language', language);
  }, [language]);

  // Get translations for current language
  const translations = useMemo(() => {
    return languages[language] || languages.english;
  }, [language]);

  // Translation function with placeholder support
  const t = useMemo(() => {
    return (key, params = {}) => {
      let translation = translations[key] || key;
      
      // Replace placeholders like {current}, {total}, {letter}, etc.
      Object.keys(params).forEach(paramKey => {
        const placeholder = `{${paramKey}}`;
        translation = translation.replace(new RegExp(placeholder, 'g'), params[paramKey]);
      });
      
      return translation;
    };
  }, [translations]);

  const changeLanguage = (newLanguage) => {
    if (languages[newLanguage]) {
      setLanguage(newLanguage);
    }
  };

  const value = {
    language,
    t,
    changeLanguage,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};
