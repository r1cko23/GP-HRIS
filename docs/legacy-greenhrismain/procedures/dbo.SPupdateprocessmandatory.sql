-- =============================================
-- Author:		<Pat Relos>
-- Create date: <07-16-2026>
-- Description:	<Update Process Mandatory>
-- =============================================
create PROCEDURE [dbo].[SPupdateprocessmandatory]	
-- Add the parameters for the stored procedure here
		
	@idpayrollsum int
AS

BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	
	
		update payroll_summary
		set 
		mandatoryforprocessing = 'Processed'
		,mandatorydateprocess=FORMAT(GETDATE(), 'MM/dd/yyyy hh:mm:ss tt')
		where  idpayrollsum = @idpayrollsum
	

END

