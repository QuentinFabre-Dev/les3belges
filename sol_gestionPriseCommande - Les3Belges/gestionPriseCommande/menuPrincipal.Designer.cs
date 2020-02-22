namespace gestionPriseCommande
{
    partial class menuPrincipal
    {
        /// <summary>
        /// Required designer variable.
        /// </summary>
        private System.ComponentModel.IContainer components = null;

        /// <summary>
        /// Clean up any resources being used.
        /// </summary>
        /// <param name="disposing">true if managed resources should be disposed; otherwise, false.</param>
        protected override void Dispose(bool disposing)
        {
            if (disposing && (components != null))
            {
                components.Dispose();
            }
            base.Dispose(disposing);
        }

        #region Windows Form Designer generated code

        /// <summary>
        /// Required method for Designer support - do not modify
        /// the contents of this method with the code editor.
        /// </summary>
        private void InitializeComponent()
        {
            this.components = new System.ComponentModel.Container();
            this.toolTip1 = new System.Windows.Forms.ToolTip(this.components);
            this.menuStrip1 = new System.Windows.Forms.MenuStrip();
            this.fichierToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.quitterToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.commandesClientToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.saisirUneCommandeToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.clientsToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.rechercherUnClientToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.nouveauClientToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.modifierCoordonnéesClientToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.produitToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.rechercherProduitToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.livraisonsToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.enregistrementsLivraisonsToolStripMenuItem = new System.Windows.Forms.ToolStripMenuItem();
            this.menuStrip1.SuspendLayout();
            this.SuspendLayout();
            // 
            // menuStrip1
            // 
            this.menuStrip1.ImageScalingSize = new System.Drawing.Size(20, 20);
            this.menuStrip1.Items.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.fichierToolStripMenuItem,
            this.commandesClientToolStripMenuItem,
            this.clientsToolStripMenuItem,
            this.produitToolStripMenuItem,
            this.livraisonsToolStripMenuItem});
            this.menuStrip1.Location = new System.Drawing.Point(0, 0);
            this.menuStrip1.Name = "menuStrip1";
            this.menuStrip1.Padding = new System.Windows.Forms.Padding(4, 2, 0, 2);
            this.menuStrip1.Size = new System.Drawing.Size(674, 33);
            this.menuStrip1.TabIndex = 0;
            this.menuStrip1.Text = "menuStrip1";
            // 
            // fichierToolStripMenuItem
            // 
            this.fichierToolStripMenuItem.DropDownItems.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.quitterToolStripMenuItem});
            this.fichierToolStripMenuItem.Font = new System.Drawing.Font("Arial Unicode MS", 13.8F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.fichierToolStripMenuItem.Name = "fichierToolStripMenuItem";
            this.fichierToolStripMenuItem.Size = new System.Drawing.Size(81, 29);
            this.fichierToolStripMenuItem.Text = "Fichier";
            // 
            // quitterToolStripMenuItem
            // 
            this.quitterToolStripMenuItem.Name = "quitterToolStripMenuItem";
            this.quitterToolStripMenuItem.Size = new System.Drawing.Size(140, 30);
            this.quitterToolStripMenuItem.Text = "&Quitter";
            this.quitterToolStripMenuItem.Click += new System.EventHandler(this.quitterToolStripMenuItem_Click);
            // 
            // commandesClientToolStripMenuItem
            // 
            this.commandesClientToolStripMenuItem.DropDownItems.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.saisirUneCommandeToolStripMenuItem});
            this.commandesClientToolStripMenuItem.Font = new System.Drawing.Font("Arial Unicode MS", 13.8F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.commandesClientToolStripMenuItem.Name = "commandesClientToolStripMenuItem";
            this.commandesClientToolStripMenuItem.Size = new System.Drawing.Size(187, 29);
            this.commandesClientToolStripMenuItem.Text = "Commandes Client";
            // 
            // saisirUneCommandeToolStripMenuItem
            // 
            this.saisirUneCommandeToolStripMenuItem.Name = "saisirUneCommandeToolStripMenuItem";
            this.saisirUneCommandeToolStripMenuItem.Size = new System.Drawing.Size(274, 30);
            this.saisirUneCommandeToolStripMenuItem.Text = "Saisir une commande ";
            this.saisirUneCommandeToolStripMenuItem.Click += new System.EventHandler(this.saisirUneCommandeToolStripMenuItem_Click);
            // 
            // clientsToolStripMenuItem
            // 
            this.clientsToolStripMenuItem.DropDownItems.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.rechercherUnClientToolStripMenuItem,
            this.nouveauClientToolStripMenuItem,
            this.modifierCoordonnéesClientToolStripMenuItem});
            this.clientsToolStripMenuItem.Font = new System.Drawing.Font("Arial Unicode MS", 13.8F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.clientsToolStripMenuItem.Name = "clientsToolStripMenuItem";
            this.clientsToolStripMenuItem.Size = new System.Drawing.Size(82, 29);
            this.clientsToolStripMenuItem.Text = "Clients";
            // 
            // rechercherUnClientToolStripMenuItem
            // 
            this.rechercherUnClientToolStripMenuItem.Name = "rechercherUnClientToolStripMenuItem";
            this.rechercherUnClientToolStripMenuItem.Size = new System.Drawing.Size(318, 30);
            this.rechercherUnClientToolStripMenuItem.Text = "Rechercher un client";
            // 
            // nouveauClientToolStripMenuItem
            // 
            this.nouveauClientToolStripMenuItem.Name = "nouveauClientToolStripMenuItem";
            this.nouveauClientToolStripMenuItem.Size = new System.Drawing.Size(318, 30);
            this.nouveauClientToolStripMenuItem.Text = "Nouveau client";
            // 
            // modifierCoordonnéesClientToolStripMenuItem
            // 
            this.modifierCoordonnéesClientToolStripMenuItem.Name = "modifierCoordonnéesClientToolStripMenuItem";
            this.modifierCoordonnéesClientToolStripMenuItem.Size = new System.Drawing.Size(318, 30);
            this.modifierCoordonnéesClientToolStripMenuItem.Text = "Modifier coordonnées client";
            // 
            // produitToolStripMenuItem
            // 
            this.produitToolStripMenuItem.DropDownItems.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.rechercherProduitToolStripMenuItem});
            this.produitToolStripMenuItem.Font = new System.Drawing.Font("Arial Unicode MS", 13.8F, System.Drawing.FontStyle.Regular, System.Drawing.GraphicsUnit.Point, ((byte)(0)));
            this.produitToolStripMenuItem.Name = "produitToolStripMenuItem";
            this.produitToolStripMenuItem.Size = new System.Drawing.Size(84, 29);
            this.produitToolStripMenuItem.Text = "Produit";
            // 
            // rechercherProduitToolStripMenuItem
            // 
            this.rechercherProduitToolStripMenuItem.Name = "rechercherProduitToolStripMenuItem";
            this.rechercherProduitToolStripMenuItem.Size = new System.Drawing.Size(246, 30);
            this.rechercherProduitToolStripMenuItem.Text = "Rechercher produit";
            // 
            // livraisonsToolStripMenuItem
            // 
            this.livraisonsToolStripMenuItem.DropDownItems.AddRange(new System.Windows.Forms.ToolStripItem[] {
            this.enregistrementsLivraisonsToolStripMenuItem});
            this.livraisonsToolStripMenuItem.Font = new System.Drawing.Font("Arial Unicode MS", 13.8F);
            this.livraisonsToolStripMenuItem.Name = "livraisonsToolStripMenuItem";
            this.livraisonsToolStripMenuItem.Size = new System.Drawing.Size(111, 29);
            this.livraisonsToolStripMenuItem.Text = "Livraisons";
            // 
            // enregistrementsLivraisonsToolStripMenuItem
            // 
            this.enregistrementsLivraisonsToolStripMenuItem.Name = "enregistrementsLivraisonsToolStripMenuItem";
            this.enregistrementsLivraisonsToolStripMenuItem.Size = new System.Drawing.Size(315, 30);
            this.enregistrementsLivraisonsToolStripMenuItem.Text = "Enregistrements Livraisons";
            this.enregistrementsLivraisonsToolStripMenuItem.Click += new System.EventHandler(this.enregistrementsLivraisonsToolStripMenuItem_Click);
            // 
            // menuPrincipal
            // 
            this.AutoScaleDimensions = new System.Drawing.SizeF(6F, 13F);
            this.AutoScaleMode = System.Windows.Forms.AutoScaleMode.Font;
            this.ClientSize = new System.Drawing.Size(674, 400);
            this.Controls.Add(this.menuStrip1);
            this.MainMenuStrip = this.menuStrip1;
            this.Margin = new System.Windows.Forms.Padding(2, 2, 2, 2);
            this.Name = "menuPrincipal";
            this.Text = "Menu Principal";
            this.Load += new System.EventHandler(this.menuPrincipal_Load);
            this.menuStrip1.ResumeLayout(false);
            this.menuStrip1.PerformLayout();
            this.ResumeLayout(false);
            this.PerformLayout();

        }

        #endregion

        private System.Windows.Forms.ToolTip toolTip1;
        private System.Windows.Forms.MenuStrip menuStrip1;
        private System.Windows.Forms.ToolStripMenuItem fichierToolStripMenuItem;
        private System.Windows.Forms.ToolStripMenuItem quitterToolStripMenuItem;
        private System.Windows.Forms.ToolStripMenuItem commandesClientToolStripMenuItem;
        private System.Windows.Forms.ToolStripMenuItem saisirUneCommandeToolStripMenuItem;
        private System.Windows.Forms.ToolStripMenuItem clientsToolStripMenuItem;
        private System.Windows.Forms.ToolStripMenuItem rechercherUnClientToolStripMenuItem;
        private System.Windows.Forms.ToolStripMenuItem nouveauClientToolStripMenuItem;
        private System.Windows.Forms.ToolStripMenuItem modifierCoordonnéesClientToolStripMenuItem;
        private System.Windows.Forms.ToolStripMenuItem produitToolStripMenuItem;
        private System.Windows.Forms.ToolStripMenuItem rechercherProduitToolStripMenuItem;
        private System.Windows.Forms.ToolStripMenuItem livraisonsToolStripMenuItem;
        private System.Windows.Forms.ToolStripMenuItem enregistrementsLivraisonsToolStripMenuItem;
    }
}