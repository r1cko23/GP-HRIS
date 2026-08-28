
-- =============================================
-- Author:		Nianz
-- Create date: 2023.July.04 @ 04:03
-- Description:	List of payroll summary
-- =============================================
CREATE PROCEDURE [dbo].[usp_clientbranchpositionListclick] 
	-- Add the parameters for the stored procedure here
		@idclientbranchposition INT
		--@idclientp INT, 
		--@Date_Start DateTime
AS
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;

    -- Select statements for procedure here
	--DECLARE
	--	@idpayrollsum INT, 
	--	@idclientp INT, 
	--	@Date_Start DateTime

	--SET @idpayrollsum = 403 
	--SET @idclientp = 15 
	--SET @Date_Start = '2022-12-01'

	select idbranchposition, 
                   department, 
                   jobposition, 
                   newrate,
                   dailyratepayroll, 
				   allowance,
                   positionecola, 
                   positionsea, 
                   positionctpa, 
                   regularOTrate,
                   nightdiffrate, 
				   regularnightdiffOTrate, 

                   legalnoworkrate, 
                   legalholidayrate, 
				   legalholidayrate2,
                   legalholidayOTrate, 
                   legalholidayNDrate, 
				   lhotndrate, 
                   
				   specialholidayrate, 
				   specialholidayrate2,
                   specialholidayOTrate,
                   specialholidaynightdiffrate, 
				   shotndrate, 
                   
				   RDrate, 
				   RDOTrate,
				   RDNDrate,
				   rdndotrate,	                   

				   lhwdorate, 
				   lhwdootrate, 
				   lhwdondrate, 
				   lhwdootndrate,

				   wdoshrate, 
				   wdoshotrate, 
				   wdoshndrate, 
				   wdoshotndrate,


				   WDORate, 
				   SHonRDOT, 
                   LHonRDOT, 
                   
                   
                   
                   
                   billingdailyratepayroll, 
                   billingpositionecola, 
                   billingregularOTrate, 
                   billingnightdiffrate, 
                   billinglegalholidayrate, 
                   billinglegalholidayOTrate, 
                   billinglegalholidayNDrate, 
                   billingspecialholidayrate, 
                   billingspecialholidayOTrate, 
                   billingspecialholidaynightdiffrate, 
                   billingSHonRDOT, 
                   billingLHonRDOT, 
                   billingRDrate, 
                   billingWDORate 
                   FROM client_branch_position 
                   WHERE idbranchposition= @idclientbranchposition 			
  END
