using System;
using System.Collections.Generic;
using les3belges;
using ClassLibraryL3B;

namespace les3belges
{
    public class Commande
    {
        //Propriétées
        private int numCommande;
        private int dateCommande;
        private double montantCommandeHT;
        private string statutCommande;
        private double montantCommandeTTC;
        private Client leClient;
        private List<LigneCommandeClient> lesLignes;
        private double poids;
        //Méthodes
        public Commande(int unNumCommande, int uneDateCommande, double unMontantCommandeHT, string unStatutCommande, double unmontantCommandeTTC, Client unClient)
        {
            numCommande = unNumCommande;
            dateCommande = uneDateCommande;
            montantCommandeHT = unMontantCommandeHT;
            statutCommande = unStatutCommande;
            montantCommandeTTC = unmontantCommandeTTC;
            leClient = unClient;
            lesLignes = new List<LigneCommandeClient>();
        }
        public Commande(Client unClient)
        {
            dateCommande = Passerelle.DateNowToInt();
            statutCommande = "A";
            montantCommandeHT = 0;
            leClient = unClient;
            lesLignes = new List<LigneCommandeClient>();
        }

        public void calculPoidsCommande()
        {
            double pds = 0;
            lesLignes = Passerelle.getLignesCmd(this);
            foreach(LigneCommandeClient ligne in lesLignes)
            {
                pds = pds + ligne.getLeProduit().getPoids();
            }
            poids = pds;
        }
        public double getPoids()
        {
            calculPoidsCommande();
            return poids;
        }
        public void ajouterUneLigneCommande(LigneCommandeClient uneLigne)
        {
            lesLignes.Add(uneLigne);
        }
        public void setNumCde(int unNum)
        { numCommande=unNum;}
        public List<LigneCommandeClient> getLesLignes()
        {   return lesLignes;         }
        public int getNumCommande()
        {   return numCommande;       }
        public int getDateCommande()
        {   return dateCommande;      }
        public double getMontantCommandeHT()
        {
            return montantCommandeHT;
        }
        public string getStatutCommande()
        {
            return statutCommande;
        }
        public double getMontantCommandeTTC()
        {
            return montantCommandeTTC;
        }
        public void setMontantCommandeTTC(double unMontant)
        {
            montantCommandeTTC = unMontant;
        }
        public Client getLeClient()
        {
            return leClient;
        }
        public void setMontantHT(double unMontantHT)
        {
            this.montantCommandeHT = unMontantHT;
        }
        
        public void setLesLignes(List<LigneCommandeClient> colLignes)
        {
            lesLignes = colLignes;

        }
    }
}
