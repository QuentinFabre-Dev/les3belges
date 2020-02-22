using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace gestionPriseCommande
{
    public class Facturer
    {
        private Expediteur expediteur;
        private double poids;
        private double prix;


        //Constructeur
        public Facturer(Expediteur unExpediteur, double pds, double prx)
        {
            poids = pds;
            prix = prx;
            expediteur = unExpediteur;
        }


        //Accesseurs 
        public Expediteur getExpediteur()
        { return expediteur; }

        public double getPoids()
        { return poids; }

        public double getPrix()
        { return prix; }

    }
}
