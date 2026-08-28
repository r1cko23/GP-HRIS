
-- =============================================
-- Author:		Pats Relos
-- Create date:11-8-2024 @ 04:03pm
-- Description:	List of payroll summary
-- =============================================
CREATE PROCEDURE [dbo].[billing-cancel] 
	-- Add the parameters for the stored procedure here
	@idclient int,
	@billingreference  nvarchar(30)
	
AS

BEGIN
	
SET NOCOUNT ON;

UPDATE       payroll_summary
SET             transfertoforbilling = 'N',   transfertoforbillingfinal = 'N' 
FROM            payroll_summary INNER JOIN
                         BILLINGTABLE ON payroll_summary.idpayrollsum = BILLINGTABLE.IDpayrollsum
WHERE        (BILLINGTABLE.billingreference = @billingreference) and PAYROLL_SUMMARY.idclientp = @idclient

 
 -- reupdate the status of billing 
	update BILLINGTABLE 
	set billingstatus  = 'Cancelled'
	where billingreference = @billingreference	and billingstatus = 'Processed' 

	update tbl_Bill_TemplateData 
	set billingstatus  = 'Cancelled'
	where billingreference = @billingreference
	   


END



