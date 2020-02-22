using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace gestionPriseCommande
{
    public class Expediteur
    {
        private String libelleExp;
        private int idExp;

        //Constructeur 
        public Expediteur(int id,String libelle)
        {
            libelleExp = libelle;
            idExp = id;
        }




        //Accesseurs 
        public String getLibelleExp()
        { return libelleExp; }

        public int getIdExp()
        { return idExp; }
    }
}
