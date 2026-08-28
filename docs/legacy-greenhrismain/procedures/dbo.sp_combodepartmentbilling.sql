create PROCEDURE [dbo].[sp_combodepartmentbilling] 
	-- Add the parameters for the stored procedure here
		@billingreference nvarchar(70)
AS 
BEGIN
	-- SET NOCOUNT ON added to prevent extra result sets from
	-- interfering with SELECT statements.
	SET NOCOUNT ON;
	
SELECT distinct billingdepartment
FROM           BILLINGTABLE
where billingreference= @billingreference
order by billingdepartment
   
END
