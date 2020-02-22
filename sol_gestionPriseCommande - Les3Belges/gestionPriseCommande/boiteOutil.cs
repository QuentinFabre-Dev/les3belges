using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace gestionPriseCommande
{
    class boiteOutil
    {
        /// <summary>
        /// retourne la chaine passée en paramètre en majuscule
        /// </summary>
        /// <param name="uneChaine">string une chaine</param>
        /// <returns>string chaine en majuscule</returns>
        public static string enMajuscule(string uneChaine)
        {
            string chaineRet = uneChaine;
            chaineRet = chaineRet.ToUpper();
            return chaineRet;
        }


        public static string changerNombreVirgule(double nb)
        {
            String nombre = nb.ToString().Replace(",", ".");
            return nombre;
        }



        /// <summary>
        /// retourne une chaine préfixée avec des 0 sur une longueur voulue
        /// </summary>
        /// <param name="longueur">int longueur souhaitée</param>
        /// <param name="chaine">string chaine d'origine</param>
        /// <returns>chaine complétée</returns>
        public static string ajouterZero(int longueur, string chaine)
        {
            string chaineRet = "";
            int nbZero = longueur - chaine.Length;
            for (int i = 1; i <= nbZero; i++)
            { chaineRet = chaineRet + "0"; }
            chaineRet = chaineRet + chaine;
            return chaineRet;
        }
        public static int dateEnNum(DateTime uneDate)
        {
            int dateRet;
            string date1 = uneDate.Year.ToString() + ajouterZero(2, uneDate.Month.ToString()) + ajouterZero(2, uneDate.Day.ToString());
            dateRet = Int32.Parse(date1);
            return dateRet;
        }
        /// <summary>
        /// retourne une date en DateTime à partir dune date entière
        /// </summary>
        /// <param name="uneDateInt">int la date sous la forme AAAMMJJ</param>
        /// <returns>DateTime la date sous la forme JJ/MM/AAAA 00:00</returns>
        public static DateTime dateEnDateTime(int uneDateInt)
        {
            DateTime dateRes;
            string date1 = uneDateInt.ToString().Substring(6, 2) + "/" + uneDateInt.ToString().Substring(4, 2) + "/" + uneDateInt.ToString().Substring(0, 4);
            dateRes = Convert.ToDateTime(date1);
            return dateRes;
        }
    }
}
