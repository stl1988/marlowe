import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppContext } from '@/hooks/useAppContext';

interface LanguagePickerProps {
  className?: string;
}

export function LanguagePicker({ className }: LanguagePickerProps) {
  const { t } = useTranslation();
  const { config, updateConfig } = useAppContext();

  const handleLanguageChange = (language: string) => {
    updateConfig((prev) => ({ ...prev, language: language === 'system' ? undefined : language }));
  };

  return (
    <Select value={config.language ?? 'system'} onValueChange={handleLanguageChange}>
      <SelectTrigger className={className}>
        <div className="flex items-center gap-2">
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="system">
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4" />
            {t('systemLanguage')}
          </div>
        </SelectItem>
        <SelectItem value="en">
          <div className="flex items-center gap-2">
            <span className="text-lg">🇺🇸</span>
            {t('english')}
          </div>
        </SelectItem>
        <SelectItem value="pt">
          <div className="flex items-center gap-2">
            <span className="text-lg">🇧🇷</span>
            {t('portuguese')}
          </div>
        </SelectItem>
        <SelectItem value="zh">
          <div className="flex items-center gap-2">
            <span className="text-lg">🇨🇳</span>
            {t('chinese')}
          </div>
        </SelectItem>
        <SelectItem value="ha">
          <div className="flex items-center gap-2">
            <span className="text-lg">🇳🇬</span>
            {t('hausa')}
          </div>
        </SelectItem>
        <SelectItem value="yo">
          <div className="flex items-center gap-2">
            <span className="text-lg">🇳🇬</span>
            {t('yoruba')}
          </div>
        </SelectItem>
        <SelectItem value="ig">
          <div className="flex items-center gap-2">
            <span className="text-lg">🇳🇬</span>
            {t('igbo')}
          </div>
        </SelectItem>
        <SelectItem value="de">
          <div className="flex items-center gap-2">
            <span className="text-lg">🇩🇪</span>
            {t('german')}
          </div>
        </SelectItem>
        <SelectItem value="es">
          <div className="flex items-center gap-2">
            <span className="text-lg">🇪🇸</span>
            {t('spanish')}
          </div>
        </SelectItem>
        <SelectItem value="fr">
          <div className="flex items-center gap-2">
            <span className="text-lg">🇫🇷</span>
            {t('french')}
          </div>
        </SelectItem>
        <SelectItem value="it">
          <div className="flex items-center gap-2">
            <span className="text-lg">🇮🇹</span>
            {t('italian')}
          </div>
        </SelectItem>
        <SelectItem value="nl">
          <div className="flex items-center gap-2">
            <span className="text-lg">🇳🇱</span>
            {t('dutch')}
          </div>
        </SelectItem>
        <SelectItem value="pl">
          <div className="flex items-center gap-2">
            <span className="text-lg">🇵🇱</span>
            {t('polish')}
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}