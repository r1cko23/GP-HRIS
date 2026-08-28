
-- =============================================
-- Author:		Nianz
-- Create date: 2023.July.04 @ 04:03
-- Description:	List of payroll summary
-- =============================================
create PROCEDURE [dbo].[usp_PayrollSummaryviewmandatoryonly] 
	-- Add the parameters for the stored procedure here
		@idpayrollsum INT
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

	SELECT idpayrollsum, idclientp, Date_Start,
		employee_id, 
		contributionpagibigEE, 
		contributionpagibigER, 
		contributionSSSEE, 
		contributionSSSER, 
		contributionSSSECC, 
		contributionSSSEEpro, 
		contributionSSSERpro, 
		contributionphilhealthEE, 
		contributionphilhealthER 
		
	FROM
		payroll_summary 
	WHERE 
		idpayrollsum = @idpayrollsum  
	               
END
