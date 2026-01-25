import React, { createContext, useContext, useState, useMemo } from 'react';
import { english } from '../locales/english';

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
};

export const LanguageProvider = ({ children, defaultLanguage = 'english' }) => {
  const [language, setLanguage] = useState(defaultLanguage);

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
