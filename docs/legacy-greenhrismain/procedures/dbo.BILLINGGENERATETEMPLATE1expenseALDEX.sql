



-- =============================================
-- Author:		<Pat Relos>
-- Create date: <5-5-2023>
-- Description:	<Include Other Dedution and Adjustment in Payroll Summary>
-- =============================================
create PROCEDURE [dbo].[BILLINGGENERATETEMPLATE1expenseALDEX]
@billingreference nvarchar(20),
@idclient int,
@datestart date = null

AS	
BEGIN
SET NOCOUNT ON;
  
INSERT INTO tbl_Bill_TemplateDataexpense
                         (particular, amount)
SELECT        particular, amount
FROM            BILLINGEXPENSE
WHERE        idclient =@idclient and datefrom= @datestart


/*
INSERT INTO tbl_Bill_TemplateDataexpense
                         (particular, amount)
VALUES        (N'Uniform', 1000)	   

INSERT INTO tbl_Bill_TemplateDataexpense
                         (particular, amount)
VALUES        (N'Test Cost', 1500)	   

INSERT INTO tbl_Bill_TemplateDataexpense
                         (particular, amount)
VALUES        (N'Food Service', 3500)	   

*/

DECLARE @JsonResult NVARCHAR(MAX);

SELECT @JsonResult = (Select top 3 [Particular] = particular, [Amount] = amount from 	tbl_Bill_TemplateDataexpense
FOR JSON PATH, INCLUDE_NULL_VALUES);

SELECT @JsonResult;


		
END 
